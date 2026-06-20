const express = require("express");
const router = express.Router();
const axios = require("axios");

// ─────────────────────────────────────────────
// Helper: safe fetch proxy (stream safe)
// ─────────────────────────────────────────────
async function fetchAsStream(targetUrl) {
    return await axios.get(targetUrl, {
        responseType: "stream",
        timeout: 30000,
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*",
            "Referer": targetUrl
        },
        maxRedirects: 5
    });
}

// ─────────────────────────────────────────────
// GET /api/gemini/edit
// ─────────────────────────────────────────────
router.get("/edit", async (req, res) => {
    let { url, prompt } = req.query;

    if (!url || !prompt) {
        return res.status(400).json({
            status: false,
            message: "URL and prompt required.",
            example: "/api/gemini/edit?url=https://example.com/photo.jpg&prompt=make+it+realistic"
        });
    }

    try {
        // 🔥 FIX: always encode safely (nested URL safe)
        const safeUrl = encodeURIComponent(url);
        const safePrompt = encodeURIComponent(prompt);

        const apiUrl =
            `https://ancient-shadow-466c.sakibbaboxod.workers.dev/?url=https://api-faa.my.id/faa/editfoto?url=${safeUrl}&prompt=${safePrompt}`;

        const response = await fetchAsStream(apiUrl);

        const contentType =
            response.headers["content-type"] || "image/jpeg";

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Access-Control-Allow-Origin", "*");

        // 🔥 STREAM DIRECT (NO BUFFER = NO CORRUPTION)
        response.data.pipe(res);

    } catch (err) {
        console.error("Edit API error:", err.message);

        if (!res.headersSent) {
            return res.status(500).json({
                status: false,
                message: "Could not edit image.",
                error: err.message
            });
        }
    }
});

// ─────────────────────────────────────────────
// API INFO
// ─────────────────────────────────────────────
router.get("/", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}/api/gemini`;

    res.json({
        status: true,
        message: "Gemini Image Tools by Adi.0X (Proxy Enabled)",
        endpoints: [
            {
                name: "Image Edit",
                method: "GET",
                endpoint: "/edit",
                params: [
                    { name: "url", type: "string", required: true },
                    { name: "prompt", type: "string", required: true }
                ],
                response: "Direct image (stream)",
                example: `${base}/edit?url=https://example.com/photo.jpg&prompt=make+it+realistic`
            }
        ]
    });
});

module.exports = router;
