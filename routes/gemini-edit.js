const express = require("express");
const router = express.Router();
const axios = require("axios");
const FormData = require("form-data");

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
        const imageResponse = await axios.get(url, { responseType: 'stream' });

        const form = new FormData();
        form.append('image', imageResponse.data); 
        form.append('param', prompt);

        const response = await axios.post('https://api.nexray.eu.cc/ai/nanobanana', form, {
            headers: {
                ...form.getHeaders()
            },
            responseType: 'stream'
        });

        res.setHeader("Content-Type", response.headers["content-type"] || "image/jpeg");
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
