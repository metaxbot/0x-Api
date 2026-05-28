const express = require("express");
const router = express.Router();
const puppeteer = require("puppeteer");

// ================================================================
//  Pinterest Search API — Puppeteer (Real Browser)
//  Routes:
//    GET /api/pinterest/pins?q=cat&limit=10
//    GET /api/pinterest/videos?q=cat&limit=10
//    GET /api/pinterest/users?q=cat&limit=10
//    GET /api/pinterest/boards?q=cat&limit=10
// ================================================================

// Browser instance reuse করা — প্রতি request এ নতুন browser না খুলে
let browserInstance = null;

async function getBrowser() {
    if (browserInstance && browserInstance.isConnected()) return browserInstance;
    browserInstance = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled", // bot detection bypass
            "--disable-infobars",
            "--window-size=1280,800",
        ],
    });
    return browserInstance;
}

// ──────────────────────────────────────────────
//  Pinterest intercept করে API response নেওয়া
// ──────────────────────────────────────────────
async function scrapeWithBrowser(scope, query, limit = 10) {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        // Bot detection bypass
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => false });
            window.chrome = { runtime: {} };
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        );
        await page.setViewport({ width: 1280, height: 800 });

        // Pinterest API response intercept করা
        const collectedData = [];

        page.on("response", async (response) => {
            const url = response.url();
            // Pinterest এর BaseSearchResource API response ধরা
            if (url.includes("BaseSearchResource") || url.includes("/resource/") && url.includes("Search")) {
                try {
                    const json = await response.json();
                    const items = json?.resource_response?.data;
                    if (Array.isArray(items)) {
                        collectedData.push(...items);
                    }
                } catch (_) {}
            }
        });

        // Pinterest সার্চ পেজে যাওয়া
        const searchUrl = `https://www.pinterest.com/search/${scope}/?q=${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

        // পেজ লোড হওয়ার জন্য একটু অপেক্ষা
        await new Promise((r) => setTimeout(r, 3000));

        // যদি intercept এ কিছু না পাওয়া যায়, DOM থেকে নেওয়া
        if (collectedData.length === 0) {
            const domData = await page.evaluate(() => {
                // Redux state থেকে
                const reduxEl = document.querySelector("[data-redux-store]");
                if (reduxEl) {
                    try { return JSON.parse(reduxEl.getAttribute("data-redux-store")); } catch (_) {}
                }
                // __PWS_DATA__ script tag থেকে
                const scripts = Array.from(document.querySelectorAll("script"));
                for (const s of scripts) {
                    if (s.id === "__PWS_DATA__" || s.textContent.includes("__initialReduxState__")) {
                        try {
                            const match = s.textContent.match(/window\.__initialReduxState__\s*=\s*({.+?});/s);
                            if (match) return JSON.parse(match[1]);
                        } catch (_) {}
                    }
                }
                return null;
            });

            if (domData) {
                // Redux resources থেকে data বের করা
                const resources = domData?.resources || {};
                for (const key of Object.keys(resources)) {
                    const res = resources[key];
                    if (res?.status === "success" && Array.isArray(res?.data)) {
                        collectedData.push(...res.data);
                    }
                }
            }
        }

        return collectedData.slice(0, limit);

    } finally {
        await page.close();
    }
}

// ──────────────────────────────────────────────
//  Parsers
// ──────────────────────────────────────────────
function parsePin(pin) {
    if (!pin?.id) return null;
    const images = pin.images || {};
    const img = images["736x"]?.url || images["564x"]?.url || images["236x"]?.url || null;
    return {
        id: pin.id,
        title: pin.title || pin.grid_title || null,
        description: pin.description || null,
        url: `https://www.pinterest.com/pin/${pin.id}/`,
        image: img,
        dominant_color: pin.dominant_color || null,
        saves: pin.repin_count ?? 0,
        comments: pin.comment_count ?? 0,
        created_at: pin.created_at || null,
        pinner: pin.pinner ? {
            username: pin.pinner.username,
            full_name: pin.pinner.full_name || null,
            profile_url: `https://www.pinterest.com/${pin.pinner.username}/`,
            avatar: pin.pinner.image_medium_url || null,
        } : null,
        board: pin.board ? {
            name: pin.board.name,
            url: `https://www.pinterest.com${pin.board.url}`,
        } : null,
    };
}

function parseVideo(pin) {
    if (!pin?.id) return null;
    const formats = Object.values(pin.videos?.video_list || {}).filter((v) => v?.url);
    const best = formats.sort((a, b) => (b.width || 0) - (a.width || 0))[0] || null;
    return {
        id: pin.id,
        title: pin.title || pin.grid_title || null,
        description: pin.description || null,
        url: `https://www.pinterest.com/pin/${pin.id}/`,
        thumbnail: pin.images?.["736x"]?.url || null,
        video_url: best?.url || null,
        video_width: best?.width || null,
        video_height: best?.height || null,
        duration_ms: pin.videos?.duration || null,
        saves: pin.repin_count ?? 0,
        pinner: pin.pinner ? {
            username: pin.pinner.username,
            full_name: pin.pinner.full_name || null,
            profile_url: `https://www.pinterest.com/${pin.pinner.username}/`,
            avatar: pin.pinner.image_medium_url || null,
        } : null,
    };
}

function parseUser(user) {
    if (!user?.id) return null;
    return {
        id: user.id,
        username: user.username,
        full_name: user.full_name || null,
        bio: user.about || null,
        profile_url: `https://www.pinterest.com/${user.username}/`,
        avatar: user.image_medium_url || null,
        followers: user.follower_count ?? 0,
        following: user.following_count ?? 0,
        pins: user.pin_count ?? 0,
        boards: user.board_count ?? 0,
        location: user.location || null,
        website: user.website_url || null,
        verified: !!user.verified_identity,
    };
}

function parseBoard(board) {
    if (!board?.id) return null;
    return {
        id: board.id,
        name: board.name,
        description: board.description || null,
        url: `https://www.pinterest.com${board.url}`,
        cover_image: board.cover_images?.["736x"]?.url || board.cover_pin?.images?.["736x"]?.url || null,
        pin_count: board.pin_count ?? 0,
        follower_count: board.follower_count ?? 0,
        privacy: board.privacy || "public",
        category: board.category || null,
        created_at: board.created_at || null,
        owner: board.owner ? {
            username: board.owner.username,
            full_name: board.owner.full_name || null,
            profile_url: `https://www.pinterest.com/${board.owner.username}/`,
            avatar: board.owner.image_medium_url || null,
        } : null,
    };
}

const PARSERS = { pins: parsePin, videos: parseVideo, users: parseUser, boards: parseBoard };

// ──────────────────────────────────────────────
//  Route factory
// ──────────────────────────────────────────────
function makeRoute(type) {
    return async (req, res) => {
        const query = req.query.q?.trim();
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

        if (!query) {
            return res.status(400).json({
                status: false,
                message: `Query required. Example: /api/pinterest/${type}?q=cats&limit=10`,
            });
        }

        try {
            const raw = await scrapeWithBrowser(type, query, limit);
            const results = raw.map(PARSERS[type]).filter(Boolean);

            res.json({
                status: true,
                creator: "Adi.0X",
                type,
                query,
                total_results: results.length,
                results,
            });
        } catch (err) {
            res.status(500).json({ status: false, error: err.message });
        }
    };
}

router.get("/pins",   makeRoute("pins"));
router.get("/videos", makeRoute("videos"));
router.get("/users",  makeRoute("users"));
router.get("/boards", makeRoute("boards"));

// Server বন্ধ হলে browser ও বন্ধ করা
process.on("exit", () => browserInstance?.close());

module.exports = router;
