const express = require("express");
const router = express.Router();
const axios = require("axios");

const LENS_UPLOAD_API = "https://lens.google.com/uploadbyurl?url=";

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
];
function randomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ─────────────────────────────────────────────
// Helper: pull every AF_initDataCallback(...) blob out of the page
// ─────────────────────────────────────────────
function extractDataBlobs(html) {
    const blobs = [];
    const regex = /AF_initDataCallback\(\s*(\{[\s\S]*?\})\s*\)\s*;/g;
    let m;
    while ((m = regex.exec(html)) !== null) {
        blobs.push(m[1]);
    }
    return blobs;
}

// ─────────────────────────────────────────────
// Helper: heuristically pull visual-match style results out of a blob
// (Google's internal schema is obfuscated/undocumented & changes often,
//  so instead of hardcoding array indices we scan for the recognizable
//  string patterns: an external result link, a gstatic thumbnail, and a
//  human-readable title, occurring near each other in the blob.)
// ─────────────────────────────────────────────
function extractVisualMatches(blob) {
    const stringRegex = /"((?:\\.|[^"\\])*)"/g;
    const tokens = [];
    let m;
    while ((m = stringRegex.exec(blob)) !== null) {
        let val = m[1];
        try { val = JSON.parse(`"${val}"`); } catch (_) {}
        tokens.push(val);
    }

    const isThumb = (s) => /^https:\/\/encrypted-tbn\d*\.gstatic\.com\/images/.test(s);
    const isExternalLink = (s) =>
        /^https?:\/\//.test(s) &&
        !/google\.com|gstatic\.com|googleusercontent\.com|schema\.org/.test(s);
    const isTitle = (s) =>
        typeof s === "string" &&
        s.length > 2 &&
        s.length < 200 &&
        !/^https?:\/\//.test(s) &&
        /[a-zA-Z\u00C0-\u024F\u0980-\u09FF]/.test(s) &&
        !/^[a-z0-9_-]{10,}$/i.test(s); // skip opaque IDs

    const matches = [];
    const seen = new Set();

    for (let i = 0; i < tokens.length; i++) {
        if (!isThumb(tokens[i])) continue;

        // Look backward/forward within a small window for a link + title
        let link = null, title = null, source = null;
        for (let j = Math.max(0, i - 6); j < Math.min(tokens.length, i + 6); j++) {
            if (!link && isExternalLink(tokens[j])) link = tokens[j];
        }
        for (let j = Math.max(0, i - 6); j < Math.min(tokens.length, i + 6); j++) {
            if (!title && isTitle(tokens[j])) title = tokens[j];
        }

        if (link && !seen.has(link)) {
            seen.add(link);
            try { source = new URL(link).hostname.replace(/^www\./, ""); } catch (_) {}
            matches.push({
                title: title || null,
                link,
                thumbnail: tokens[i],
                source
            });
        }
    }

    return matches;
}

// ─────────────────────────────────────────────
// GET /api/tools/lens?url=  — Endpoint Info
// ─────────────────────────────────────────────
router.get("/", async (req, res) => {
    const imageUrl = req.query.url;

    if (!imageUrl) {
        return res.status(400).json({
            status: false,
            message: "URL parameter is required. Example: /api/tools/lens?url=https://example.com/image.jpg"
        });
    }

    try {
        const target = `${LENS_UPLOAD_API}${encodeURIComponent(imageUrl)}`;

        const response = await axios.get(target, {
            timeout: 20000,
            maxRedirects: 5,
            headers: {
                "User-Agent": randomUA(),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                // Bypass Google's cookie-consent interstitial, which otherwise
                // returns a "before you continue" page with zero results.
                "Cookie": "CONSENT=YES+cb.20240101-00-p0.en+FX+000; SOCS=CAI"
            },
            validateStatus: () => true
        });

        const html = response.data;
        const searchUrl =
            response.request?.res?.responseUrl ||
            response.request?._redirectable?._currentUrl ||
            target;

        if (typeof html !== "string" || html.length === 0) {
            return res.status(502).json({
                status: false,
                message: "Empty response from Google Lens. Please check the image URL."
            });
        }

        // Find the richest data blob (most gstatic thumbnails = visual matches blob)
        const blobs = extractDataBlobs(html);
        let bestMatches = [];
        for (const blob of blobs) {
            const found = extractVisualMatches(blob);
            if (found.length > bestMatches.length) bestMatches = found;
        }

        const result = {
            status: true,
            creator: "Adi.0X",
            image_url: imageUrl,
            search_url: searchUrl,
            total_matches: bestMatches.length,
            matches: bestMatches
        };

        // Temporary diagnostics: /api/tools/lens?url=...&debug=true
        // Helps figure out why matches may be empty without needing server console access.
        if (req.query.debug === "true") {
            result.debug = {
                html_length: html.length,
                blob_count: blobs.length,
                gstatic_thumb_count: (html.match(/encrypted-tbn\d*\.gstatic\.com/g) || []).length,
                looks_like_consent_page: /consent\.google\.com|before you continue/i.test(html),
                html_sample: html.slice(0, 1500)
            };
        }

        return res.json(result);

    } catch (err) {
        return res.status(500).json({
            status: false,
            message: "Something went wrong: " + err.message
        });
    }
});

module.exports = router;
