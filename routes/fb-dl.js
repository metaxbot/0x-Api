const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");

router.get("/dl", async (req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({
            status: false,
            message: "Please provide a Facebook Video/Reel URL in the 'url' parameter."
        });
    }

    try {
        // Facebook theke raw HTML fetch kora
        const { data } = await axios.get(videoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const $ = cheerio.load(data);

        // ১. Metadata Extraction (Title, Page Name, Thumbnail)
        const ogTitle = $('meta[property="og:title"]').attr('content') || "";
        const ogImage = $('meta[property="og:image"]').attr('content') || "";
        
        // Title ar Page Name split kora (FB format: Title | PageName)
        let title = ogTitle;
        let pageName = "Unknown Page";
        
        if (ogTitle.includes('|')) {
            const parts = ogTitle.split('|');
            title = parts[0].trim();
            pageName = parts[1].trim();
        }

        // ২. Video ID extract kora URL theke
        const idMatch = videoUrl.match(/(?:videos|reel|reels|watch)\/(\d+)/);
        const videoId = idMatch ? idMatch[1] : "N/A";

        // ৩. Quality Links Extraction (Regex logic)
        // Facebook HTML e eita "browser_native_sd_url" name e thake
        const sdMatch = data.match(/"browser_native_sd_url":"(.*?)"/);
        const hdMatch = data.match(/"browser_native_hd_url":"(.*?)"/);

        let downloadLinks = [];
        
        if (sdMatch && sdMatch[1]) {
            downloadLinks.push({
                quality: "SD",
                url: sdMatch[1].replace(/\\/g, '') // Backslash remove korar jonno
            });
        }
        
        if (hdMatch && hdMatch[1]) {
            downloadLinks.push({
                quality: "HD",
                url: hdMatch[1].replace(/\\/g, '')
            });
        }

        // Response pathano
        res.json({
            status: true,
            data: {
                id: videoId,
                page_name: pageName,
                title: title,
                thumbnail: ogImage,
                links: downloadLinks
            },
            author: "Adi.0X"
        });

    } catch (error) {
        console.error("Scraping Error:", error.message);
        res.status(500).json({
            status: false,
            message: "Failed to scrap video info. Facebook might be blocking the request.",
            error: error.message
        });
    }
});

module.exports = router;
