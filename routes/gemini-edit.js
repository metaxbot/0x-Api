const express = require("express");
const router = express.Router();
const axios = require("axios");

// ─────────────────────────────────────────────
// GET /api/gemini/edit?url=&prompt=
// ─────────────────────────────────────────────
router.get("/edit", async (req, res) => {
    const { url, prompt } = req.query;

    if (!url || !prompt) {
        return res.status(400).json({
            status: false,
            message: "URL and prompt required.",
            example: "/api/gemini/edit?url=https://example.com/photo.jpg&prompt=make+it+realistic"
        });
    }

    try {
        const apiUrl = `https://api-faa.my.id/faa/editfoto?url=${encodeURIComponent(url)}&prompt=${encodeURIComponent(prompt)}`;

        const response = await axios.get(apiUrl, {
            responseType: "stream",
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const contentType = response.headers["content-type"] || "image/png";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "no-cache");

        response.data.pipe(res);

    } catch (err) {
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
// GET /api/gemini — Info
// ─────────────────────────────────────────────
router.get("/", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}/api/gemini`;
    res.json({
        status: true,
        message: "Gemini Image Tools by Adi.0X",
        endpoints: [
            {
                name: "Image Edit",
                method: "GET",
                endpoint: "/edit",
                params: [
                    { name: "url",    type: "string", required: true, description: "এডিট করার ছবির direct URL" },
                    { name: "prompt", type: "string", required: true, description: "কীভাবে এডিট করবে" }
                ],
                response: "Direct image (binary)",
                example: `${base}/edit?url=https://example.com/photo.jpg&prompt=make+it+realistic`
            }
        ]
    });
});

module.exports = router;

