const express = require("express");
const router = express.Router();
const axios = require("axios");

// ─────────────────────────────────────────────
// GET /api/gemini/edit
// ─────────────────────────────────────────────
router.get("/edit", async (req, res) => {
    const { url, prompt } = req.query;

    if (!url || !prompt) {
        return res.status(400).json({
            status: false,
            message: "URL and prompt required.",
            example: "/api/gemini/edit?url=https://example.com/photo.jpg&prompt=change+jersey"
        });
    }

    try {
        const apiRes = await axios.get("https://api.snowping.cfd/api/imageai/nanobanana", {
            params: {
                url: url,
                prompt: prompt
            }
        });

        const imageUrl = apiRes.data?.result?.image;

        if (!imageUrl) {
            return res.status(500).json({
                status: false,
                message: "Failed to generate image URL from API.",
                details: apiRes.data
            });
        }

        const imageStream = await axios.get(imageUrl, { responseType: 'stream' });

        res.setHeader("Content-Type", imageStream.headers["content-type"] || "image/webp");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Access-Control-Allow-Origin", "*");

        imageStream.data.pipe(res);

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
        message: "Gemini Image Tools (Updated)",
        endpoints: [
            {
                name: "Image Edit",
                endpoint: "/edit",
                example: `${base}/edit?url=https://example.com/photo.jpg&prompt=change+jersey`
            }
        ]
    });
});

module.exports = router;
