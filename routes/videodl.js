const express = require("express");
const router = express.Router();
const axios = require("axios");

// ─────────────────────────────────────────────
// Source API (All-in-one downloader)
// Supports: Facebook, Instagram, TikTok, Pinterest,
// CapCut, X (Twitter), Snapchat, etc.
// ─────────────────────────────────────────────
const SOURCE_API = "https://api.nexray.eu.cc/downloader/aio?url=";

// ─────────────────────────────────────────────
// Helper: score a video candidate by resolution / quality hints
// Higher score = better quality
// ─────────────────────────────────────────────
function scoreCandidate({ width, height, resolution, bitrate, quality }) {
    let score = 0;

    // Prefer real resolution info when present
    if (width && height) {
        score += width * height;
    } else if (resolution && /(\d+)x(\d+)/i.test(resolution)) {
        const [, w, h] = resolution.match(/(\d+)x(\d+)/i);
        score += parseInt(w) * parseInt(h);
    }

    if (bitrate) score += Number(bitrate) / 10; // small nudge, resolution matters more

    const q = (quality || "").toLowerCase();
    if (q.includes("full hd")) score += 3000;
    else if (q.includes("hd")) score += 2000;

    if (q.includes("no_watermark") || q.includes("no watermark")) score += 1000;
    if (/(^|[^n])watermark/.test(q) && !q.includes("no_watermark") && !q.includes("no watermark")) score -= 1500;
    if (q.includes("sd") && !q.includes("hd")) score -= 500;

    return score;
}

// ─────────────────────────────────────────────
// Helper: pick best (HD) and second-best (SD) video links
// from the "medias" array returned by the source API
// ─────────────────────────────────────────────
function pickHDSD(medias) {
    if (!Array.isArray(medias)) return { HD: null, SD: null };

    let candidates = [];

    for (const m of medias) {
        if (m.type !== "video" || !m.url) continue;

        candidates.push({
            url: m.url,
            score: scoreCandidate(m)
        });

        // Some sources (e.g. X/Twitter) nest extra mp4 resolutions inside "formats"
        if (Array.isArray(m.formats)) {
            for (const f of m.formats) {
                if (f.url && (f.container === "mp4" || /\.mp4($|\?)/i.test(f.url))) {
                    candidates.push({
                        url: f.url,
                        score: scoreCandidate({ bitrate: f.bitrate, quality: m.quality })
                    });
                }
            }
        }
    }

    if (candidates.length === 0) return { HD: null, SD: null };

    // Dedupe by URL, keep highest score
    const byUrl = new Map();
    for (const c of candidates) {
        if (!byUrl.has(c.url) || byUrl.get(c.url) < c.score) byUrl.set(c.url, c.score);
    }
    const unique = [...byUrl.entries()].map(([url, score]) => ({ url, score }));
    unique.sort((a, b) => b.score - a.score);

    const HD = unique[0].url;
    const SD = unique.length > 1 ? unique[1].url : unique[0].url;

    return { HD, SD };
}

// ─────────────────────────────────────────────
// GET /api/vdl?url=  — Universal All-Video Downloader
// ─────────────────────────────────────────────
router.get("/", async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({
            status: false,
            message: "URL parameter is required. Example: /api/vdl?url=https://..."
        });
    }

    try {
        const { data } = await axios.get(
            `${SOURCE_API}${encodeURIComponent(url)}`,
            { timeout: 15000 }
        );

        if (!data || !data.status || !data.result) {
            return res.status(500).json({
                status: false,
                message: "Failed to fetch data. Please check the URL and try again."
            });
        }

        const result = data.result;
        const { HD, SD } = pickHDSD(result.medias);

        if (!HD) {
            return res.status(404).json({
                status: false,
                message: "No downloadable video found for this URL."
            });
        }

        return res.json({
            status: true,
            platform: result.source || null,
            title: result.title || null,
            video: {
                HD,
                SD
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: false,
            message: "Something went wrong: " + err.message
        });
    }
});

module.exports = router;
