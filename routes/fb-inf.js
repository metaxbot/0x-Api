const express = require("express");
const router = express.Router();

const ACCESS_TOKEN = "6628568379|c1e620fa708a1d5696fb991c1bde5662";

// ─────────────────────────────────────────────
// GET /api/fb/ — Available Endpoints
// ─────────────────────────────────────────────
router.get("/", (req, res) => {
    const base = `${req.protocol}://${req.get("host")}/api/fb`;

    res.json({
        status: true,
        message: "Facebook API by Adi.0X",
        base_url: base,
        endpoints: [
            {
                name: "Get Facebook UID",
                method: "GET",
                endpoint: "/uid",
                params: [
                    { name: "url", type: "string", required: true, description: "Facebook profile/page URL" }
                ],
                example: `${base}/uid?url=https://facebook.com/zuck`
            },
            {
                name: "Get Profile Picture by URL",
                method: "GET",
                endpoint: "/pp",
                params: [
                    { name: "url", type: "string", required: true, description: "Facebook profile/page URL" }
                ],
                example: `${base}/pp?url=https://facebook.com/zuck`
            },
            {
                name: "Get Profile Picture by UID",
                method: "GET",
                endpoint: "/pp",
                params: [
                    { name: "uid", type: "string", required: true, description: "Facebook User ID" }
                ],
                example: `${base}/pp?uid=4`
            }
        ]
    });
});

// ─────────────────────────────────────────────
// GET /api/fb/uid?url=
// ─────────────────────────────────────────────
router.get("/uid", async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({
            status: false,
            message: "URL required. Example: /api/fb/uid?url=https://facebook.com/zuck"
        });
    }

    try {
        const body = new URLSearchParams({ link: url }).toString();

        const response = await fetch("https://id.traodoisub.com/api.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
                "Referer": "https://id.traodoisub.com/"
            },
            body
        });

        const data = await response.json();

        if (data && data.id) {
            return res.json({
                status: true,
                creator: "Adi.0X",
                uid: data.id,
                url
            });
        } else {
            return res.status(400).json({
                status: false,
                message: data.error || "Could not extract UID from this link."
            });
        }

    } catch (err) {
        res.status(500).json({
            status: false,
            error: err.message
        });
    }
});

// ─────────────────────────────────────────────
// GET /api/fb/pp?url= OR /api/fb/pp?uid=
// ─────────────────────────────────────────────
router.get("/pp", async (req, res) => {
    const { url, uid } = req.query;

    if (!url && !uid) {
        return res.status(400).json({
            status: false,
            message: "URL or UID required. Example: /api/fb/pp?url=https://facebook.com/zuck OR /api/fb/pp?uid=4"
        });
    }

    try {
        let finalUid = uid;

        // url দিলে আগে uid বের করব
        if (url && !uid) {
            const body = new URLSearchParams({ link: url }).toString();

            const uidResponse = await fetch("https://id.traodoisub.com/api.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
                    "Referer": "https://id.traodoisub.com/"
                },
                body
            });

            const uidData = await uidResponse.json();

            if (!uidData || !uidData.id) {
                return res.status(400).json({
                    status: false,
                    message: uidData.error || "Could not extract UID from this URL."
                });
            }

            finalUid = uidData.id;
        }

        // Profile picture fetch
        const fbUrl = `https://graph.facebook.com/${finalUid}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;

        const imgResponse = await fetch(fbUrl);

        if (!imgResponse.ok) {
            return res.status(404).json({
                status: false,
                message: "User not found or profile picture unavailable."
            });
        }

        const arrayBuffer = await imgResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.status(200).send(buffer);

    } catch (err) {
        res.status(500).json({
            status: false,
            error: err.message
        });
    }
});

module.exports = router;
