const express = require("express");
const router = express.Router();

const BASE_API = "https://www.myinstants.com/api/v1/instants/";

// ─────────────────────────────────────────────
// GET /api/instants/
// ─────────────────────────────────────────────
router.get("/", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}/api/sounds`;
    res.json({
        status: true,
        message: "Sounds API by Adi.0X",
        base_url: base,
        endpoints: [
            {
                name: "Search Sounds",
                method: "GET",
                endpoint: "/search",
                params: [
                    { name: "q", type: "string", required: true, description: "Search query" },
                    { name: "page", type: "number", required: false, description: "Page number (default: 1)" }
                ],
                example: `${base}/search?q=hello&page=1`
            }
        ]
    });
});

// ─────────────────────────────────────────────
// GET /api/instants/search?q=hello&page=1
// ─────────────────────────────────────────────
router.get("/search", async (req, res) => {
    const { q, page } = req.query;

    if (!q) {
        return res.status(400).json({
            status: false,
            message: "Query required. Example: /api/sounds/search?q=hello&page=1"
        });
    }

    try {
        let targetUrl = `${BASE_API}?format=json&name=${encodeURIComponent(q)}`;
        if (page) targetUrl += `&page=${page}`;

        const response = await fetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                status: false,
                message: "Failed to fetch."
            });
        }

        const data = await response.json();

        // Pagination rewrite
        const rewritePagination = (originalUrl) => {
            if (!originalUrl) return null;
            try {
                const urlObj = new URL(originalUrl);
                const nextPage = urlObj.searchParams.get("page") || 1;
                return `${req.protocol}://${req.get("host")}${req.baseUrl}/search?q=${encodeURIComponent(q)}&page=${nextPage}`;
            } catch {
                return null;
            }
        };

        res.json({
            status: true,
            creator: "Adi.0X",
            query: q,
            count: data.count || 0,
            next: rewritePagination(data.next),
            previous: rewritePagination(data.previous),
            results: (data.results || []).map(item => ({
                name: item.name || null,
                slug: item.slug || null,
                sound: item.sound || null,
                color: item.color || null,
                image: item.image || null,
                description: item.description || null,
                tags: item.tags || []
            }))
        });

    } catch (err) {
        res.status(500).json({
            status: false,
            error: err.message
        });
    }
});

module.exports = router;
