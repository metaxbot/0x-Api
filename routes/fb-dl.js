const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");

// ইউটিলিটি: Facebook-এর ইউনিকোড এনকোডেড URL ডিকোড
function decodeFBUrl(url) {
    let res = url.replace(/\\/g, '');
    try {
        res = JSON.parse(`"${res}"`);
    } catch (e) {}
    return res;
}

router.get("/dl", async (req, res) => {
    let videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ status: false, message: "URL required" });

    try {
        const { data: html } = await axios.get(videoUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none"
            }
        });

        // cheerio দিয়ে মেটা ট্যাগ পার্স (টাইটেল ও থাম্বনেইল)
        const $ = cheerio.load(html);
        const title = $('meta[property="og:title"]').attr('content') || $('title').text() || "Facebook Video";
        const thumbnail = ($('meta[property="og:image"]').attr('content') || "").replace(/&amp;/g, '&');

        // সব সম্ভাব্য ভিডিও কী থেকে লিংক বের করা (first script থেকে নেওয়া)
        const sdMatch = html.match(/"browser_native_sd_url":"(.*?)"/) || html.match(/sd_src_no_ratelimit:"(.*?)"/);
        const hdMatch = html.match(/"browser_native_hd_url":"(.*?)"/) || html.match(/hd_src_no_ratelimit:"(.*?)"/);
        const playableMatch = html.match(/"playable_url":"(.*?)"/);
        const qualityMatch = html.match(/"playable_url_quality_hd":"(.*?)"/);

        const links = [];

        if (hdMatch) links.push({ quality: "HD", url: decodeFBUrl(hdMatch[1]) });
        if (qualityMatch) links.push({ quality: "HD (Reel)", url: decodeFBUrl(qualityMatch[1]) });
        if (sdMatch) links.push({ quality: "SD", url: decodeFBUrl(sdMatch[1]) });
        if (playableMatch && links.length === 0) links.push({ quality: "SD", url: decodeFBUrl(playableMatch[1]) });

        // ফ্যালব্যাক: ভিডিও ট্যাগ থেকে src (যদি উপরের কোনোটাই না পায়)
        if (links.length === 0) {
            const videoSrc = $('video').attr('src');
            if (videoSrc) links.push({ quality: "Normal", url: videoSrc });
        }

        res.json({
            status: true,
            data: {
                title,
                thumbnail,
                links
            },
            author: "Adi.0X"
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Failed to fetch video data.",
            error: error.message
        });
    }
});

module.exports = router;
