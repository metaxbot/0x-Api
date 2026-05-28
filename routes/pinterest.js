const express = require("express");
const router = express.Router();

// ================================================================
//  Pinterest Search API  (HTML + Internal API fallback)
//  Routes:
//    GET /api/pinterest/pins?q=cat&limit=10
//    GET /api/pinterest/videos?q=cat&limit=10
//    GET /api/pinterest/users?q=cat&limit=10
//    GET /api/pinterest/boards?q=cat&limit=10
// ================================================================

// Pinterest এর internal resource API — এটাই আসল ডাটা দেয়
const RESOURCE_API = "https://www.pinterest.com/resource/BaseSearchResource/get/";

const BASE_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*, q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    "X-APP-VERSION": "8f2de85",
    "X-Pinterest-AppState": "active",
    "Referer": "https://www.pinterest.com/",
};

// ──────────────────────────────────────────────
//  Internal API call করা
// ──────────────────────────────────────────────
async function callPinterestAPI(scope, query, limit = 10, bookmarks = []) {
    const options = {
        query,
        scope,
        page_size: Math.min(limit, 50),
        redux_normalize_feed: true,
    };

    if (bookmarks.length > 0) options.bookmarks = bookmarks;

    const params = new URLSearchParams({
        source_url: `/search/${scope}/?q=${encodeURIComponent(query)}`,
        data: JSON.stringify({ options, context: {} }),
    });

    const url = `${RESOURCE_API}?${params.toString()}`;
    const response = await fetch(url, { headers: BASE_HEADERS });

    if (!response.ok) {
        throw new Error(`Pinterest API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();

    if (json?.code !== undefined && json.code !== 0) {
        throw new Error(`Pinterest returned error code ${json.code}: ${json.message}`);
    }

    return json?.resource_response?.data || [];
}

// ──────────────────────────────────────────────
//  PINS parser
// ──────────────────────────────────────────────
function parsePin(pin) {
    if (!pin || !pin.id) return null;

    const images = pin.images || {};
    const bestImage =
        images["736x"]?.url ||
        images["564x"]?.url ||
        images["474x"]?.url ||
        images["236x"]?.url ||
        null;

    return {
        id: pin.id,
        title: pin.title || pin.grid_title || null,
        description: pin.description || null,
        url: `https://www.pinterest.com/pin/${pin.id}/`,
        image: bestImage,
        dominant_color: pin.dominant_color || null,
        saves: pin.repin_count ?? 0,
        comments: pin.comment_count ?? 0,
        created_at: pin.created_at || null,
        pinner: pin.pinner
            ? {
                  username: pin.pinner.username,
                  full_name: pin.pinner.full_name || null,
                  profile_url: `https://www.pinterest.com/${pin.pinner.username}/`,
                  avatar: pin.pinner.image_medium_url || null,
                  followers: pin.pinner.follower_count ?? 0,
              }
            : null,
        board: pin.board
            ? {
                  name: pin.board.name,
                  url: `https://www.pinterest.com${pin.board.url}`,
              }
            : null,
    };
}

// ──────────────────────────────────────────────
//  VIDEOS parser
// ──────────────────────────────────────────────
function parseVideo(pin) {
    if (!pin || !pin.id) return null;

    const videoList = pin.videos?.video_list || {};
    const formats = Object.values(videoList).filter((v) => v?.url);
    // সবচেয়ে ভালো quality নেওয়া
    const best =
        formats.sort((a, b) => (b.width || 0) - (a.width || 0))[0] || null;

    const thumbnail =
        pin.images?.["736x"]?.url || pin.images?.["564x"]?.url || null;

    return {
        id: pin.id,
        title: pin.title || pin.grid_title || null,
        description: pin.description || null,
        url: `https://www.pinterest.com/pin/${pin.id}/`,
        thumbnail,
        video_url: best?.url || null,
        video_width: best?.width || null,
        video_height: best?.height || null,
        duration_ms: pin.videos?.duration || null,
        saves: pin.repin_count ?? 0,
        pinner: pin.pinner
            ? {
                  username: pin.pinner.username,
                  full_name: pin.pinner.full_name || null,
                  profile_url: `https://www.pinterest.com/${pin.pinner.username}/`,
                  avatar: pin.pinner.image_medium_url || null,
              }
            : null,
    };
}

// ──────────────────────────────────────────────
//  USERS parser
// ──────────────────────────────────────────────
function parseUser(user) {
    if (!user || !user.id) return null;
    return {
        id: user.id,
        username: user.username,
        full_name: user.full_name || null,
        bio: user.about || null,
        profile_url: `https://www.pinterest.com/${user.username}/`,
        avatar: user.image_medium_url || user.image_small_url || null,
        followers: user.follower_count ?? 0,
        following: user.following_count ?? 0,
        pins: user.pin_count ?? 0,
        boards: user.board_count ?? 0,
        location: user.location || null,
        website: user.website_url || null,
        verified: !!user.verified_identity,
    };
}

// ──────────────────────────────────────────────
//  BOARDS parser
// ──────────────────────────────────────────────
function parseBoard(board) {
    if (!board || !board.id) return null;

    const cover =
        board.cover_images?.["736x"]?.url ||
        board.cover_pin?.images?.["736x"]?.url ||
        null;

    return {
        id: board.id,
        name: board.name,
        description: board.description || null,
        url: `https://www.pinterest.com${board.url}`,
        cover_image: cover,
        pin_count: board.pin_count ?? 0,
        follower_count: board.follower_count ?? 0,
        collaborator_count: board.collaborator_count ?? 0,
        privacy: board.privacy || "public",
        created_at: board.created_at || null,
        category: board.category || null,
        owner: board.owner
            ? {
                  username: board.owner.username,
                  full_name: board.owner.full_name || null,
                  profile_url: `https://www.pinterest.com/${board.owner.username}/`,
                  avatar: board.owner.image_medium_url || null,
              }
            : null,
    };
}

// ──────────────────────────────────────────────
//  Generic scraper factory
// ──────────────────────────────────────────────
function makeScraper(scope, parser) {
    return async (query, limit) => {
        const rawItems = await callPinterestAPI(scope, query, limit);
        return rawItems.map(parser).filter(Boolean).slice(0, limit);
    };
}

const scrapers = {
    pins:   makeScraper("pins",   parsePin),
    videos: makeScraper("videos", parseVideo),
    users:  makeScraper("users",  parseUser),
    boards: makeScraper("boards", parseBoard),
};

// ──────────────────────────────────────────────
//  Route factory
// ──────────────────────────────────────────────
function makeRoute(type) {
    return async (req, res) => {
        const query = req.query.q?.trim();
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

        if (!query) {
            return res.status(400).json({
                status: false,
                message: `Query required. Example: /api/pinterest/${type}?q=cats&limit=10`,
            });
        }

        try {
            const results = await scrapers[type](query, limit);
            res.json({
                status: true,
                creator: "Adi.0X",
                type,
                query,
                total_results: results.length,
                results,
            });
        } catch (err) {
            res.status(500).json({
                status: false,
                error: err.message,
            });
        }
    };
}

// ──────────────────────────────────────────────
//  Routes
// ──────────────────────────────────────────────
router.get("/pins",   makeRoute("pins"));
router.get("/videos", makeRoute("videos"));
router.get("/users",  makeRoute("users"));
router.get("/boards", makeRoute("boards"));

module.exports = router;
