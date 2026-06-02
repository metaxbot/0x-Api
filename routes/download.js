const express = require("express");
const router = express.Router();
const axios = require("axios");

// ─────────────────────────────────────────────
// প্ল্যাটফর্ম ডিটেক্ট করা
// ─────────────────────────────────────────────
function detectPlatform(url) {
    if (/facebook\.com|fb\.watch|fb\.com/i.test(url)) return "facebook";
    if (/instagram\.com/i.test(url)) return "instagram";
    return null;
}

// ─────────────────────────────────────────────
// Facebook Downloader (ফলব্যাক সহ ৩টা API)
// ─────────────────────────────────────────────
async function facebookDownload(url) {
    const encodedUrl = encodeURIComponent(url);

    // API ১: api-faa.my.id
    try {
        const { data } = await axios.get(
            `https://api-faa.my.id/faa/fbdownload?url=${encodedUrl}`,
            { timeout: 10000 }
        );

        if (data.status && data.result?.media) {
            const media = data.result.media;
            return {
                status: true,
                creator: "Adi.0X",
                platform: "facebook",
                data: {
                    title: data.result?.info?.title || "Facebook Video",
                    thumbnail: null,
                    links: [
                        media.video_hd && { quality: "HD", type: "video", url: media.video_hd },
                        media.video_sd && { quality: "SD", type: "video", url: media.video_sd }
                    ].filter(Boolean)
                }
            };
        }
    } catch (_) {}

    // API ২: api.nexray.eu.cc
    try {
        const { data } = await axios.get(
            `https://api.nexray.eu.cc/downloader/facebook?url=${encodedUrl}`,
            { timeout: 10000 }
        );

        if (data.status && data.result) {
            const r = data.result;
            return {
                status: true,
                creator: "Adi.0X",
                platform: "facebook",
                data: {
                    title: r.title || "Facebook Video",
                    thumbnail: null,
                    links: [
                        r.video_hd && { quality: "HD", type: "video", url: r.video_hd },
                        r.video_sd && { quality: "SD", type: "video", url: r.video_sd },
                        r.audio   && { quality: "Audio", type: "audio", url: r.audio }
                    ].filter(Boolean)
                }
            };
        }
    } catch (_) {}

    // API ৩: api.siputzx.my.id
    try {
        const { data } = await axios.get(
            `https://api.siputzx.my.id/api/d/facebook?url=${encodedUrl}`,
            { timeout: 10000 }
        );

        if (data.status && data.data) {
            const d = data.data;
            return {
                status: true,
                creator: "Adi.0X",
                platform: "facebook",
                data: {
                    title: d.title || "Facebook Video",
                    thumbnail: d.thumbnail || null,
                    links: (d.downloads || []).map(item => ({
                        quality: item.quality,
                        type: item.type,
                        url: item.url
                    }))
                }
            };
        }
    } catch (_) {}

    throw new Error("সব Facebook API ফেল করেছে। URL টি সঠিক কিনা চেক করুন।");
}

// ─────────────────────────────────────────────
// Instagram Downloader
// ─────────────────────────────────────────────
async function instagramDownload(url) {
    const encodedUrl = encodeURIComponent(url);

    try {
        const { data } = await axios.get(
            `https://api.nexray.eu.cc/downloader/instagram?url=${encodedUrl}`,
            { timeout: 10000 }
        );

        if (data.status && Array.isArray(data.result) && data.result.length > 0) {
            const links = data.result.map(item => ({
                quality: item.type === "video" ? "HD" : "Original",
                type: item.type,       // "video" অথবা "image"
                thumbnail: item.thumbnail || null,
                url: item.url
            }));

            return {
                status: true,
                creator: "Adi.0X",
                platform: "instagram",
                data: {
                    title: "Instagram Media",
                    thumbnail: links[0]?.thumbnail || null,
                    links
                }
            };
        }
    } catch (_) {}

    throw new Error("Instagram API ফেল করেছে। URL টি সঠিক কিনা চেক করুন।");
}

// ─────────────────────────────────────────────
// GET /api/dl — Endpoint Info
// ─────────────────────────────────────────────
router.get("/", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}/api/dl`;
    res.json({
        status: true,
        message: "Universal Media Downloader by Adi.0X",
        base_url: base,
        supported_platforms: ["facebook", "instagram"],
        endpoints: [
            {
                name: "Universal Download",
                method: "GET",
                endpoint: "/",
                params: [{ name: "url", type: "string", required: true, description: "যেকোনো সাপোর্টেড প্ল্যাটফর্মের URL" }],
                example: `${base}?url=https://www.facebook.com/share/v/1DmqBWjF4s/`
            },
            {
                name: "Facebook Download",
                method: "GET",
                endpoint: "/facebook",
                params: [{ name: "url", type: "string", required: true, description: "Facebook video/reel URL" }],
                example: `${base}/facebook?url=https://www.facebook.com/share/v/1DmqBWjF4s/`
            },
            {
                name: "Instagram Download",
                method: "GET",
                endpoint: "/instagram",
                params: [{ name: "url", type: "string", required: true, description: "Instagram reel/post URL" }],
                example: `${base}/instagram?url=https://www.instagram.com/reel/DY-ZlxZTVtV/`
            }
        ]
    });
});

// ─────────────────────────────────────────────
// GET /api/dl?url=  (অটো ডিটেক্ট)
// ─────────────────────────────────────────────
router.get("/download", async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).json({
            status: false,
            message: "URL প্যারামিটার দরকার। Example: /api/dl/download?url=https://..."
        });
    }

    const platform = detectPlatform(url);
    if (!platform) {
        return res.status(400).json({
            status: false,
            message: "সাপোর্টেড প্ল্যাটফর্ম নয়। এখন সাপোর্ট করে: facebook, instagram"
        });
    }

    try {
        let result;
        if (platform === "facebook") result = await facebookDownload(url);
        else if (platform === "instagram") result = await instagramDownload(url);

        return res.json(result);
    } catch (err) {
        return res.status(500).json({
            status: false,
            platform,
            message: err.message
        });
    }
});

// ─────────────────────────────────────────────
// GET /api/dl/facebook?url=
// ─────────────────────────────────────────────
router.get("/facebook", async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).json({
            status: false,
            message: "URL প্যারামিটার দরকার। Example: /api/dl/facebook?url=https://..."
        });
    }

    try {
        const result = await facebookDownload(url);
        return res.json(result);
    } catch (err) {
        return res.status(500).json({
            status: false,
            platform: "facebook",
            message: err.message
        });
    }
});

// ─────────────────────────────────────────────
// GET /api/dl/instagram?url=
// ─────────────────────────────────────────────
router.get("/instagram", async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).json({
            status: false,
            message: "URL প্যারামিটার দরকার। Example: /api/dl/instagram?url=https://..."
        });
    }

    try {
        const result = await instagramDownload(url);
        return res.json(result);
    } catch (err) {
        return res.status(500).json({
            status: false,
            platform: "instagram",
            message: err.message
        });
    }
});

module.exports = router;
