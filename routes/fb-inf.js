const express = require("express");
const router = express.Router();

const ACCESS_TOKEN = "6628568379|c1e620fa708a1d5696fb991c1bde5662";

// ─────────────────────────────────────────────
// UID ক্যাশ (url → { uid, timestamp })
// ─────────────────────────────────────────────
const uidCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // ২৪ ঘণ্টা

// ─────────────────────────────────────────────
// User‑Agent রোটেশন লিস্ট
// ─────────────────────────────────────────────
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
];

function randomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ─────────────────────────────────────────────
// রেট-লিমিট সহ এক্সটার্নাল UID ফেচার (কুইউ ও রিট্রাই)
// ─────────────────────────────────────────────
let lastCallTime = 0;
const MIN_INTERVAL = 1000; // ১ সেকেন্ড অপেক্ষা, একসাথে রিকোয়েস্ট ঠেকাতে

async function fetchUidFromExternal(url) {
    // আগে ক্যাশ চেক
    const cached = uidCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.uid;
    }

    // গত কলের সাথে ন্যূনতম ব্যবধান নিশ্চিত করা
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL - (now - lastCallTime));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastCallTime = Date.now();

    const body = new URLSearchParams({ link: url }).toString();
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            const response = await fetch("https://id.traodoisub.com/api.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": randomUA(),
                    "Referer": "https://id.traodoisub.com/"
                },
                body
            });

            const data = await response.json();

            // সফল হলে ক্যাশে রেখে রিটার্ন
            if (data && data.id) {
                uidCache.set(url, { uid: data.id, timestamp: Date.now() });
                return data.id;
            }

            // রেট-লিমিট মেসেজ পেলে অপেক্ষা করে আবার চেষ্টা
            const msg = (data.error || "").toLowerCase();
            if (msg.includes("chậm") || msg.includes("slow") || msg.includes("vui lòng")) {
                const backoff = Math.pow(2, attempts) * 1000 + Math.random() * 1000; // 2s, 4s, 8s ±
                await new Promise(r => setTimeout(r, backoff));
                continue;
            }

            // অন্য কোনো এরর
            throw new Error(data.error || "Could not extract UID from this link.");
        } catch (err) {
            if (attempts >= maxAttempts) throw err;
            // নেটওয়ার্ক ফেলিও থাকতে পারে
            await new Promise(r => setTimeout(r, 2000 * attempts));
        }
    }

    throw new Error("Failed after retries.");
}

// ─────────────────────────────────────────────
// GET /api/fb/ — Available Endpoints
// ─────────────────────────────────────────────
router.get("/", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}/api/fb`;
    res.json({
        status: true,
        message: "Facebook API by Adi.0X",
        base_url: base,
        endpoints: [
            {
                name: "Get Facebook UID",
                method: "GET",
                endpoint: "/uid",
                params: [{ name: "url", type: "string", required: true, description: "Facebook profile/page URL" }],
                example: `${base}/uid?url=https://facebook.com/zuck`
            },
            {
                name: "Get Profile Picture by URL",
                method: "GET",
                endpoint: "/pp",
                params: [{ name: "url", type: "string", required: true, description: "Facebook profile/page URL" }],
                example: `${base}/pp?url=https://facebook.com/zuck`
            },
            {
                name: "Get Profile Picture by UID",
                method: "GET",
                endpoint: "/pp",
                params: [{ name: "uid", type: "string", required: true, description: "Facebook User ID" }],
                example: `${base}/pp?uid=4`
            }
        ]
    });
});

// ─────────────────────────────────────────────
// GET /api/fb/uid?url=
// ─────────────────────────────────────────────
router.get("/uid", async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).json({
            status: false,
            message: "URL required. Example: /api/fb/uid?url=https://facebook.com/zuck"
        });
    }

    try {
        const uid = await fetchUidFromExternal(url);
        return res.json({
            status: true,
            creator: "Adi.0X",
            uid,
            url
        });
    } catch (err) {
        return res.status(400).json({
            status: false,
            message: err.message
        });
    }
});

// ─────────────────────────────────────────────
// GET /api/fb/pp?url= OR /api/fb/pp?uid=
// ─────────────────────────────────────────────
router.get("/pp", async (req, res) => {
    const { url, uid } = req.query;

    if (!url && !uid) {
        return res.status(400).json({
            status: false,
            message: "URL or UID required. Example: /api/fb/pp?url=https://facebook.com/zuck OR /api/fb/pp?uid=4"
        });
    }

    try {
        let finalUid = uid;

        if (url && !uid) {
            finalUid = await fetchUidFromExternal(url);  // এখানে ক্যাশ কাজ করবে
        }

        // ফেসবুক গ্রাফ থেকে প্রোফাইল ছবি
        const fbUrl = `https://graph.facebook.com/${finalUid}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
        const imgResponse = await fetch(fbUrl);

        if (!imgResponse.ok) {
            return res.status(404).json({
                status: false,
                message: "User not found or profile picture unavailable."
            });
        }

        const arrayBuffer = await imgResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.status(200).send(buffer);

    } catch (err) {
        return res.status(500).json({
            status: false,
            error: err.message
        });
    }
});

module.exports = router;
