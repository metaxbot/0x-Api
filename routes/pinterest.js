const express = require("express");
const router = express.Router();

// ========================================
//   Pinterest Search Scraper
//   Routes:
//     /api/pinterest/pins?q=cat&limit=10
//     /api/pinterest/videos?q=cat&limit=10
//     /api/pinterest/users?q=cat&limit=10
//     /api/pinterest/boards?q=cat&limit=10
// ========================================

const BASE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
};

/**
 * Pinterest HTML থেকে window.__initialReduxState__ বা
 * পেজের JSON ডাটা বের করে
 */
function extractReduxData(html) {
    // পদ্ধতি ১: __PWS_INITIAL_PROPS__
    let part = html.split("P.startsWith('__PWS_INITIAL_PROPS__')")[0];
    
    // পদ্ধতি ২: window.__initialReduxState__
    if (html.includes("__initialReduxState__")) {
        const segment = html.split("window.__initialReduxState__ = ")[1];
        if (segment) {
            const jsonStr = segment.split(";\n")[0];
            try {
                return { type: "redux", data: JSON.parse(jsonStr) };
            } catch (_) {}
        }
    }

    // পদ্ধতি ৩: __PWS_DATA__
    if (html.includes("__PWS_DATA__")) {
        const segment = html.split('id="__PWS_DATA__">')[1];
        if (segment) {
            const jsonStr = segment.split("</script>")[0];
            try {
                return { type: "pws", data: JSON.parse(jsonStr) };
            } catch (_) {}
        }
    }

    return null;
}

/**
 * Redux state থেকে resource data বের করে
 */
function getResourceResults(reduxData) {
    try {
        const resources = reduxData?.data?.resources || {};
        for (const key of Object.keys(resources)) {
            const res = resources[key];
            if (res?.status === "success" && Array.isArray(res?.data)) {
                return res.data;
            }
        }
    } catch (_) {}
    return [];
}

// ─────────────────────────────────────────────
//  PINS স্ক্র্যাপার
// ─────────────────────────────────────────────
async function scrapePins(query, limit = 10) {
    const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, { headers: BASE_HEADERS });
    if (!response.ok) throw new Error(`Pinterest responded with ${response.status}`);

    const html = await response.text();
    const extracted = extractReduxData(html);
    if (!extracted) throw new Error("Could not extract Pinterest data from page.");

    const items = getResourceResults(extracted);
    const results = [];

    for (const pin of items) {
        if (!pin || !pin.id) continue;

        const images = pin.images || {};
        const bestImage =
            images["736x"]?.url ||
            images["564x"]?.url ||
            images["236x"]?.url ||
            null;

        results.push({
            id: pin.id,
            title: pin.title || pin.grid_title || "No title",
            description: pin.description || null,
            url: `https://www.pinterest.com/pin/${pin.id}/`,
            image: bestImage,
            dominant_color: pin.dominant_color || null,
            saves: pin.repin_count || 0,
            comments: pin.comment_count || 0,
            created_at: pin.created_at || null,
            pinner: pin.pinner
                ? {
                    username: pin.pinner.username,
                    full_name: pin.pinner.full_name,
                    profile_url: `https://www.pinterest.com/${pin.pinner.username}/`,
                    avatar: pin.pinner.image_medium_url || null,
                }
                : null,
            board: pin.board
                ? {
                    name: pin.board.name,
                    url: `https://www.pinterest.com${pin.board.url}`,
                }
                : null,
        });

        if (results.length >= limit) break;
    }

    return results;
}

// ─────────────────────────────────────────────
//  VIDEOS স্ক্র্যাপার
// ─────────────────────────────────────────────
async function scrapeVideos(query, limit = 10) {
    const url = `https://www.pinterest.com/search/videos/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, { headers: BASE_HEADERS });
    if (!response.ok) throw new Error(`Pinterest responded with ${response.status}`);

    const html = await response.text();
    const extracted = extractReduxData(html);
    if (!extracted) throw new Error("Could not extract Pinterest data from page.");

    const items = getResourceResults(extracted);
    const results = [];

    for (const pin of items) {
        if (!pin || !pin.id) continue;

        // ভিডিও URL বের করা
        const videoSources = pin.videos?.video_list || {};
        const videoFormats = Object.values(videoSources);
        const bestVideo =
            videoFormats.find((v) => v.url && v.width >= 720) ||
            videoFormats.find((v) => v.url) ||
            null;

        const thumbnail =
            pin.images?.["736x"]?.url ||
            pin.images?.["564x"]?.url ||
            null;

        results.push({
            id: pin.id,
            title: pin.title || pin.grid_title || "No title",
            description: pin.description || null,
            url: `https://www.pinterest.com/pin/${pin.id}/`,
            thumbnail,
            video_url: bestVideo?.url || null,
            video_width: bestVideo?.width || null,
            video_height: bestVideo?.height || null,
            duration: pin.videos?.duration || null,
            saves: pin.repin_count || 0,
            pinner: pin.pinner
                ? {
                    username: pin.pinner.username,
                    full_name: pin.pinner.full_name,
                    profile_url: `https://www.pinterest.com/${pin.pinner.username}/`,
                    avatar: pin.pinner.image_medium_url || null,
                }
                : null,
        });

        if (results.length >= limit) break;
    }

    return results;
}

// ─────────────────────────────────────────────
//  USERS স্ক্র্যাপার
// ─────────────────────────────────────────────
async function scrapeUsers(query, limit = 10) {
    const url = `https://www.pinterest.com/search/users/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, { headers: BASE_HEADERS });
    if (!response.ok) throw new Error(`Pinterest responded with ${response.status}`);

    const html = await response.text();
    const extracted = extractReduxData(html);
    if (!extracted) throw new Error("Could not extract Pinterest data from page.");

    const items = getResourceResults(extracted);
    const results = [];

    for (const user of items) {
        if (!user || !user.id) continue;

        results.push({
            id: user.id,
            username: user.username,
            full_name: user.full_name || null,
            bio: user.about || null,
            profile_url: `https://www.pinterest.com/${user.username}/`,
            avatar: user.image_medium_url || user.image_small_url || null,
            followers: user.follower_count || 0,
            following: user.following_count || 0,
            pins: user.pin_count || 0,
            boards: user.board_count || 0,
            location: user.location || null,
            verified: user.verified_identity != null,
        });

        if (results.length >= limit) break;
    }

    return results;
}

// ─────────────────────────────────────────────
//  BOARDS স্ক্র্যাপার
// ─────────────────────────────────────────────
async function scrapeBoards(query, limit = 10) {
    const url = `https://www.pinterest.com/search/boards/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, { headers: BASE_HEADERS });
    if (!response.ok) throw new Error(`Pinterest responded with ${response.status}`);

    const html = await response.text();
    const extracted = extractReduxData(html);
    if (!extracted) throw new Error("Could not extract Pinterest data from page.");

    const items = getResourceResults(extracted);
    const results = [];

    for (const board of items) {
        if (!board || !board.id) continue;

        // বোর্ডের কভার ইমেজ
        const cover = board.cover_images?.["736x"] || board.cover_pin?.images?.["736x"] || null;

        results.push({
            id: board.id,
            name: board.name,
            description: board.description || null,
            url: `https://www.pinterest.com${board.url}`,
            cover_image: cover?.url || null,
            pin_count: board.pin_count || 0,
            follower_count: board.follower_count || 0,
            privacy: board.privacy || "public",
            created_at: board.created_at || null,
            owner: board.owner
                ? {
                    username: board.owner.username,
                    full_name: board.owner.full_name,
                    profile_url: `https://www.pinterest.com/${board.owner.username}/`,
                    avatar: board.owner.image_medium_url || null,
                }
                : null,
        });

        if (results.length >= limit) break;
    }

    return results;
}

// ─────────────────────────────────────────────
//  HELPER: জেনেরিক রেসপন্স হ্যান্ডলার
// ─────────────────────────────────────────────
function handleRoute(scraperFn, type) {
    return async (req, res) => {
        const query = req.query.q;
        const limit = Math.min(parseInt(req.query.limit) || 10, 50); // সর্বোচ্চ ৫০টা

        if (!query) {
            return res.status(400).json({
                status: false,
                message: `Search query required. Example: /api/pinterest/${type}?q=cats&limit=10`,
            });
        }

        try {
            const results = await scraperFn(query, limit);
            res.json({
                status: true,
                creator: "Adi.0X",
                type,
                query,
                total_results: results.length,
                results,
            });
        } catch (error) {
            res.status(500).json({
                status: false,
                error: error.message,
            });
        }
    };
}

// ─────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────

// GET /api/pinterest/pins?q=cats&limit=10
router.get("/pins", handleRoute(scrapePins, "pins"));

// GET /api/pinterest/videos?q=cats&limit=10
router.get("/videos", handleRoute(scrapeVideos, "videos"));

// GET /api/pinterest/users?q=cats&limit=10
router.get("/users", handleRoute(scrapeUsers, "users"));

// GET /api/pinterest/boards?q=cats&limit=10
router.get("/boards", handleRoute(scrapeBoards, "boards"));

module.exports = router;
