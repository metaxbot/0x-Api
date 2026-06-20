const express = require("express");
const router = express.Router();
const axios = require("axios");

// ─────────────────────────────────────────────
// YOUR PROXY BASE
// ─────────────────────────────────────────────
const PROXY_BASE =
  "https://ancient-shadow-466c.sakibbaboxod.workers.dev/?url=";

// ─────────────────────────────────────────────
// GET /api/gemini/edit
// ─────────────────────────────────────────────
router.get("/edit", async (req, res) => {
    const { url, prompt } = req.query;

    if (!url || !prompt) {
        return res.status(400).json({
            status: false,
            message: "URL and prompt required.",
            example:
                "/api/gemini/edit?url=https://example.com/photo.jpg&prompt=make+it+realistic"
        });
    }

    try {
        // FAA API URL
        const apiUrl =
            `https://api-faa.my.id/faa/editfoto` +
            `?url=${encodeURIComponent(url)}` +
            `&prompt=${encodeURIComponent(prompt)}`;

        // 🔥 PROXY WRAP HERE
        const finalUrl = PROXY_BASE + encodeURIComponent(apiUrl);

        const response = await axios.get(finalUrl, {
            responseType: "stream",
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const contentType = response.headers["content-type"] || "image/jpeg";

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Access-Control-Allow-Origin", "*");

        response.data.pipe(res);

    } catch (err) {
        return res.status(500).json({
            status: false,
            message: "Could not edit image.",
            error: err.message
        });
    }
});

// ─────────────────────────────────────────────
// INFO ROUTE
// ─────────────────────────────────────────────
router.get("/", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}/api/gemini`;

    res.json({
        status: true,
        message: "Gemini Image Tools by Adi.0X (Proxy Enabled)",
        endpoints: [
            {
                name: "Image Edit",
                endpoint: "/edit",
                example:
                    `${base}/edit?url=https://example.com/photo.jpg&prompt=make+it+realistic`
            }
        ]
    });
});

module.exports = router;
