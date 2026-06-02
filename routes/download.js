const express = require("express");
const router = express.Router();
const axios = require("axios");

// ─────────────────────────────────────────────
// Platform detection
// ─────────────────────────────────────────────
function detectPlatform(url) {
    if (/facebook\.com|fb\.watch|fb\.com/i.test(url)) return "facebook";
    if (/instagram\.com/i.test(url)) return "instagram";
    if (/tiktok\.com|vm\.tiktok\.com/i.test(url)) return "tiktok";
    return null;
}

// ─────────────────────────────────────────────
// Facebook Downloader (3 fallback APIs)
// ─────────────────────────────────────────────
async function facebookDownload(url) {
    const encodedUrl = encodeURIComponent(url);

    // API 1: api-faa.my.id
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

    // API 2: api.nexray.eu.cc
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

    // API 3: api.siputzx.my.id
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

    throw new Error("All Facebook APIs failed. Please check the URL.");
}

// ─────────────────────────────────────────────
// Instagram Downloader (2 fallback APIs: v2 → v1)
// ─────────────────────────────────────────────
async function instagramDownload(url) {
    const encodedUrl = encodeURIComponent(url);

    // API 1 (new v2)
    try {
        const { data } = await axios.get(
            `https://api.nexray.eu.cc/downloader/v2/instagram?url=${encodedUrl}`,
            { timeout: 10000 }
        );

        if (data.status && data.result && Array.isArray(data.result.media)) {
            const mediaArray = data.result.media;
            const links = mediaArray.map(item => ({
                quality: item.type === "mp4" ? "Video" : "Image",
                type: item.type,   // "mp4" or "webp" (or other)
                thumbnail: data.result.thumbnail || null,
                url: item.url
            }));

            return {
                status: true,
                creator: "Adi.0X",
                platform: "instagram",
                data: {
                    title: data.result.title || "Instagram Media",
                    thumbnail: data.result.thumbnail || null,
                    links
                }
            };
        }
    } catch (_) {}

    // API 2 (old v1) – fallback
    try {
        const { data } = await axios.get(
            `https://api.nexray.eu.cc/downloader/instagram?url=${encodedUrl}`,
            { timeout: 10000 }
        );

        if (data.status && Array.isArray(data.result) && data.result.length > 0) {
            const links = data.result.map(item => ({
                quality: item.type === "video" ? "HD" : "Original",
                type: item.type,       // "video" or "image"
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

    throw new Error("All Instagram APIs failed. Please check the URL.");
}

// ─────────────────────────────────────────────
// TikTok Downloader (2 fallback APIs: nexray → faa)
// ─────────────────────────────────────────────
async function tiktokDownload(url) {
    const encodedUrl = encodeURIComponent(url);

    // API 1: api.nexray.eu.cc
    try {
        const { data } = await axios.get(
            `https://api.nexray.eu.cc/downloader/tiktok?url=${encodedUrl}`,
            { timeout: 10000 }
        );

        if (data.status && data.result) {
            const r = data.result;
            // Build links array (video without watermark is preferred)
            const links = [];
            if (r.data) {
                links.push({ quality: "No Watermark", type: "video", url: r.data });
            }
            if (r.alternatives?.nowm) {
                links.push({ quality: "No Watermark (alt)", type: "video", url: r.alternatives.nowm });
            }
            if (r.alternatives?.wm) {
                links.push({ quality: "With Watermark", type: "video", url: r.alternatives.wm });
            }
            if (r.music_info?.url) {
                links.push({ quality: "Audio", type: "audio", url: r.music_info.url });
            }

            return {
                status: true,
                creator: "Adi.0X",
                platform: "tiktok",
                data: {
                    title: r.title || "TikTok Video",
                    thumbnail: r.cover || null,
                    links: links,
                    meta: {
                        author: r.author?.nickname || r.author?.username || null,
                        stats: r.stats || null,
                        duration: r.duration || null
                    }
                }
            };
        }
    } catch (_) {}

    // API 2: api-faa.my.id (fallback)
    try {
        const { data } = await axios.get(
            `https://api-faa.my.id/faa/tiktok?url=${encodedUrl}`,
            { timeout: 10000 }
        );

        if (data.status && data.result) {
            const r = data.result;
            const links = [];
            if (r.data) {
                links.push({ quality: "No Watermark", type: "video", url: r.data });
            }
            if (r.alternatives?.nowm) {
                links.push({ quality: "No Watermark (alt)", type: "video", url: r.alternatives.nowm });
            }
            if (r.alternatives?.wm) {
                links.push({ quality: "With Watermark", type: "video", url: r.alternatives.wm });
            }
            if (r.music_info?.url) {
                links.push({ quality: "Audio", type: "audio", url: r.music_info.url });
            }

            return {
                status: true,
                creator: "Adi.0X",
                platform: "tiktok",
                data: {
                    title: r.title || "TikTok Video",
                    thumbnail: r.cover || null,
                    links: links,
                    meta: {
                        author: r.author?.nickname || r.author?.username || null,
                        stats: r.stats || null,
                        duration: r.duration || null
                    }
                }
            };
        }
    } catch (_) {}

    throw new Error("All TikTok APIs failed. Please check the URL.");
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
        supported_platforms: ["facebook", "instagram", "tiktok"],
        endpoints: [
            {
                name: "Universal Download (auto-detect)",
                method: "GET",
                endpoint: "/download",
                params: [{ name: "url", type: "string", required: true, description: "URL of supported platform (Facebook, Instagram, TikTok)" }],
                example: `${base}/download?url=https://www.tiktok.com/@user/video/123456789`
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
            },
            {
                name: "TikTok Download",
                method: "GET",
                endpoint: "/tiktok",
                params: [{ name: "url", type: "string", required: true, description: "TikTok video URL" }],
                example: `${base}/tiktok?url=https://vm.tiktok.com/ZS92f2s9A/`
            }
        ]
    });
});

// ─────────────────────────────────────────────
// GET /api/dl/download?url=  (auto detect)
// ─────────────────────────────────────────────
router.get("/download", async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).json({
            status: false,
            message: "URL parameter is required. Example: /api/dl/download?url=https://..."
        });
    }

    const platform = detectPlatform(url);
    if (!platform) {
        return res.status(400).json({
            status: false,
            message: "Unsupported platform. Currently supports: facebook, instagram, tiktok"
        });
    }

    try {
        let result;
        if (platform === "facebook") result = await facebookDownload(url);
        else if (platform === "instagram") result = await instagramDownload(url);
        else if (platform === "tiktok") result = await tiktokDownload(url);

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
            message: "URL parameter is required. Example: /api/dl/facebook?url=https://..."
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
            message: "URL parameter is required. Example: /api/dl/instagram?url=https://..."
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

// ─────────────────────────────────────────────
// GET /api/dl/tiktok?url=
// ─────────────────────────────────────────────
router.get("/tiktok", async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).json({
            status: false,
            message: "URL parameter is required. Example: /api/dl/tiktok?url=https://..."
        });
    }

    try {
        const result = await tiktokDownload(url);
        return res.json(result);
    } catch (err) {
        return res.status(500).json({
            status: false,
            platform: "tiktok",
            message: err.message
        });
    }
});

module.exports = router;
