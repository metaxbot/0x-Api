const express = require("express");
const router = express.Router();
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

// Proxifly থেকে প্রক্সি লিস্ট ফেচ করার ফাংশন
async function getRandomProxy() {
    try {
        // Proxifly free proxy list JSON
        const proxyListUrl = "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/all/data.json";
        const response = await axios.get(proxyListUrl, { timeout: 5000 });
        const proxies = response.data;

        if (proxies && proxies.length > 0) {
            // শুধুমাত্র HTTP বা HTTPS প্রক্সি ফিল্টার করা
            const validProxies = proxies.filter(p => p.protocol === "http" || p.protocol === "https");
            
            if (validProxies.length > 0) {
                // র্যান্ডমলি একটি প্রক্সি সিলেক্ট করা
                const randomProxy = validProxies[Math.floor(Math.random() * validProxies.length)];
                // Example format: http://ip:port
                return `${randomProxy.protocol}://${randomProxy.ip}:${randomProxy.port}`;
            }
        }
    } catch (error) {
        console.error("Proxy fetch error:", error.message);
    }
    return null; // প্রক্সি না পেলে null রিটার্ন করবে
}

// ─────────────────────────────────────────────
// GET /api/gemini/edit
// ─────────────────────────────────────────────
router.get("/edit", async (req, res) => {
    const { url, prompt } = req.query;

    if (!url || !prompt) {
        return res.status(400).json({
            status: false,
            message: "URL and prompt required.",
            example: "/api/gemini/edit?url=https://example.com/photo.jpg&prompt=add+a+sunglass"
        });
    }

    // ট্রাই কাউন্ট (সর্বোচ্চ ৩ টি ভিন্ন প্রক্সি দিয়ে ট্রাই করবে)
    let maxRetries = 3;
    let success = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const proxyUrl = await getRandomProxy();
            const axiosConfig = {
                responseType: 'stream',
                timeout: 30000, // 30 সেকেন্ড টাইমআউট
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            };

            // যদি প্রক্সি পাওয়া যায়, তবে HttpsProxyAgent দিয়ে রিকোয়েস্ট এজেন্টে যোগ করব
            if (proxyUrl) {
                console.log(`[Attempt ${attempt}] Using Proxy: ${proxyUrl}`);
                const httpsAgent = new HttpsProxyAgent(proxyUrl);
                axiosConfig.httpsAgent = httpsAgent;
                axiosConfig.httpAgent = httpsAgent;
            } else {
                console.log(`[Attempt ${attempt}] No proxy available, fetching directly...`);
            }

            // Target API URL গঠন করা
            const targetUrl = `https://api-faa.my.id/faa/editfoto?url=${encodeURIComponent(url)}&prompt=${encodeURIComponent(prompt)}`;

            // FAA API তে রিকোয়েস্ট পাঠানো
            const response = await axios.get(targetUrl, axiosConfig);

            // রেসপন্স হেডার্স সেটিং
            res.setHeader("Content-Type", response.headers["content-type"] || "image/jpeg");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Access-Control-Allow-Origin", "*");

            // ফাইল স্ট্রিম করে রেসপন্স দেওয়া
            response.data.pipe(res);
            success = true;
            break; // সফল হলে লুপ থেকে বের হয়ে যাবে

        } catch (err) {
            console.error(`Attempt ${attempt} failed: ${err.message}`);
            if (attempt === maxRetries) {
                return res.status(500).json({
                    status: false,
                    message: "Could not edit image after multiple proxy attempts.",
                    error: err.message
                });
            }
        }
    }
});

// ─────────────────────────────────────────────
// INFO ROUTE
// ─────────────────────────────────────────────
router.get("/", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}/api/gemini`;

    res.json({
        status: true,
        message: "Gemini Image Tools (Updated with Proxy & FAA API)",
        endpoints: [
            {
                name: "Image Edit",
                endpoint: "/edit",
                example: `${base}/edit?url=https://example.com/photo.jpg&prompt=add+a+sunglass`
            }
        ]
    });
});

module.exports = router;
