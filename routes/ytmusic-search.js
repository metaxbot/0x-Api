const express = require("express");
const router = express.Router();

let ytmusic = null;

async function getYTMusic() {
    if (!ytmusic) {
        const YTMusicModule = await import("ytmusic-api");
        const YTMusic = YTMusicModule.default;
        ytmusic = new YTMusic();
        await ytmusic.initialize();
    }
    return ytmusic;
}

// ─────────────────────────────────────────────
// GET /api/ytmusic/search?q=co2&limit=10
// ─────────────────────────────────────────────
router.get("/search", async (req, res) => {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 10;

    if (!query) {
        return res.status(400).json({
            status: false,
            message: "Query required. Example: /api/ytmusic/search?q=co2&limit=10"
        });
    }

    try {
        const yt = await getYTMusic();
        const songs = await yt.searchSongs(query);

        const results = songs.slice(0, limit).map(song => ({
            type: "song",
            videoId: song.videoId,
            url: `https://music.youtube.com/watch?v=${song.videoId}`,
            title: song.name,
            artist: song.artist?.name || null,
            artistId: song.artist?.artistId || null,
            album: song.album?.name || null,
            albumId: song.album?.albumId || null,
            duration: song.duration || null,
            durationText: song.duration
                ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, "0")}`
                : null,
            isExplicit: song.isExplicit || false,
            thumbnail: song.thumbnails?.[song.thumbnails.length - 1]?.url || null
        }));

        res.json({
            status: true,
            creator: "Adi.0X",
            query,
            total: results.length,
            results
        });

    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/ytmusic/song?id=videoId
// ─────────────────────────────────────────────
router.get("/song", async (req, res) => {
    const id = req.query.id;
    if (!id) {
        return res.status(400).json({
            status: false,
            message: "Video ID required. Example: /api/ytmusic/song?id=6FewJvQDTmA"
        });
    }

    try {
        const yt = await getYTMusic();
        const song = await yt.getSong(id);

        res.json({
            status: true,
            creator: "Adi.0X",
            result: {
                type: "song",
                videoId: song.videoId,
                url: `https://music.youtube.com/watch?v=${song.videoId}`,
                title: song.name,
                artist: song.artist?.name || null,
                artistId: song.artist?.artistId || null,
                album: song.album?.name || null,
                albumId: song.album?.albumId || null,
                duration: song.duration || null,
                durationText: song.duration
                    ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, "0")}`
                    : null,
                isExplicit: song.isExplicit || false,
                thumbnails: song.thumbnails || [],
                thumbnail: song.thumbnails?.[song.thumbnails.length - 1]?.url || null
            }
        });

    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/ytmusic/artist?id=artistId
// ─────────────────────────────────────────────
router.get("/artist", async (req, res) => {
    const id = req.query.id;
    if (!id) {
        return res.status(400).json({
            status: false,
            message: "Artist ID required. Example: /api/ytmusic/artist?id=UCO_sphdxl8_K6mfXzzmkDGQ"
        });
    }

    try {
        const yt = await getYTMusic();
        const artist = await yt.getArtist(id);

        res.json({
            status: true,
            creator: "Adi.0X",
            result: {
                artistId: artist.artistId,
                name: artist.name,
                description: artist.description || null,
                subscribers: artist.subscribers || null,
                thumbnail: artist.thumbnails?.[artist.thumbnails.length - 1]?.url || null,
                thumbnails: artist.thumbnails || [],
                topSongs: (artist.topSongs || []).map(song => ({
                    videoId: song.videoId,
                    title: song.name,
                    album: song.album?.name || null,
                    duration: song.duration || null,
                    durationText: song.duration
                        ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, "0")}`
                        : null,
                    thumbnail: song.thumbnails?.[song.thumbnails.length - 1]?.url || null
                })),
                topAlbums: (artist.topAlbums || []).map(album => ({
                    albumId: album.albumId,
                    title: album.name,
                    year: album.year || null,
                    thumbnail: album.thumbnails?.[album.thumbnails.length - 1]?.url || null
                })),
                topSingles: (artist.topSingles || []).map(single => ({
                    albumId: single.albumId,
                    title: single.name,
                    year: single.year || null,
                    thumbnail: single.thumbnails?.[single.thumbnails.length - 1]?.url || null
                }))
            }
        });

    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/ytmusic/album?id=albumId
// ─────────────────────────────────────────────
router.get("/album", async (req, res) => {
    const id = req.query.id;
    if (!id) {
        return res.status(400).json({
            status: false,
            message: "Album ID required. Example: /api/ytmusic/album?id=MPREb_BF7bztcDvJi"
        });
    }

    try {
        const yt = await getYTMusic();
        const album = await yt.getAlbum(id);

        res.json({
            status: true,
            creator: "Adi.0X",
            result: {
                albumId: album.albumId,
                title: album.name,
                type: album.type || null,
                year: album.year || null,
                trackCount: album.trackCount || null,
                duration: album.duration || null,
                artist: album.artist?.name || null,
                artistId: album.artist?.artistId || null,
                description: album.description || null,
                thumbnail: album.thumbnails?.[album.thumbnails.length - 1]?.url || null,
                thumbnails: album.thumbnails || [],
                songs: (album.songs || []).map(song => ({
                    videoId: song.videoId,
                    title: song.name,
                    trackNumber: song.trackNumber || null,
                    duration: song.duration || null,
                    durationText: song.duration
                        ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, "0")}`
                        : null,
                    isExplicit: song.isExplicit || false,
                    thumbnail: song.thumbnails?.[song.thumbnails.length - 1]?.url || null
                }))
            }
        });

    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/ytmusic/playlist?id=playlistId
// ─────────────────────────────────────────────
router.get("/playlist", async (req, res) => {
    const id = req.query.id;
    if (!id) {
        return res.status(400).json({
            status: false,
            message: "Playlist ID required. Example: /api/ytmusic/playlist?id=PLxxx"
        });
    }

    try {
        const yt = await getYTMusic();
        const playlist = await yt.getPlaylist(id);

        res.json({
            status: true,
            creator: "Adi.0X",
            result: {
                playlistId: playlist.playlistId,
                title: playlist.name,
                description: playlist.description || null,
                trackCount: playlist.trackCount || null,
                thumbnail: playlist.thumbnails?.[playlist.thumbnails.length - 1]?.url || null,
                thumbnails: playlist.thumbnails || [],
                songs: (playlist.songs || []).map(song => ({
                    videoId: song.videoId,
                    title: song.name,
                    artist: song.artist?.name || null,
                    artistId: song.artist?.artistId || null,
                    album: song.album?.name || null,
                    albumId: song.album?.albumId || null,
                    duration: song.duration || null,
                    durationText: song.duration
                        ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, "0")}`
                        : null,
                    thumbnail: song.thumbnails?.[song.thumbnails.length - 1]?.url || null
                }))
            }
        });

    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/ytmusic/lyrics?id=videoId
// ─────────────────────────────────────────────
router.get("/lyrics", async (req, res) => {
    const id = req.query.id;
    if (!id) {
        return res.status(400).json({
            status: false,
            message: "Video ID required. Example: /api/ytmusic/lyrics?id=6FewJvQDTmA"
        });
    }

    try {
        const yt = await getYTMusic();
        const lyrics = await yt.getLyrics(id);

        res.json({
            status: true,
            creator: "Adi.0X",
            result: {
                videoId: id,
                lyrics: lyrics?.lyrics || null,
                source: lyrics?.source || null
            }
        });

    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/ytmusic/suggestions?q=co
// ─────────────────────────────────────────────
router.get("/suggestions", async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({
            status: false,
            message: "Query required. Example: /api/ytmusic/suggestions?q=co"
        });
    }

    try {
        const yt = await getYTMusic();
        const suggestions = await yt.getSearchSuggestions(query);

        res.json({
            status: true,
            creator: "Adi.0X",
            query,
            suggestions: suggestions || []
        });

    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

module.exports = router;
