// GET /api/lastfm
// Returns currently-playing (if any), recent tracks, weekly top
// tracks, and weekly top artist — all from Last.fm's public API.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nmethylpyrrolinium.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { LASTFM_API_KEY, LASTFM_USERNAME } = process.env;

  if (!LASTFM_API_KEY || !LASTFM_USERNAME) {
    return res.status(500).json({
      error: 'Missing LASTFM_API_KEY or LASTFM_USERNAME environment variable',
      debug: { hasKey: Boolean(LASTFM_API_KEY), hasUsername: Boolean(LASTFM_USERNAME) }
    });
  }

  const base = 'https://ws.audioscrobbler.com/2.0/';
  const common = `user=${encodeURIComponent(LASTFM_USERNAME)}&api_key=${LASTFM_API_KEY}&format=json`;

  try {
    const [recentRes, topTracksRes, topArtistsRes] = await Promise.all([
      fetch(`${base}?method=user.getrecenttracks&${common}&limit=6`),
      fetch(`${base}?method=user.gettoptracks&${common}&period=7day&limit=5`),
      fetch(`${base}?method=user.gettopartists&${common}&period=7day&limit=1`)
    ]);

    if (!recentRes.ok) {
      const body = await recentRes.text();
      return res.status(recentRes.status).json({
        error: `Last.fm API returned ${recentRes.status}`,
        debug: { username: LASTFM_USERNAME, body: body.slice(0, 300) }
      });
    }

    const recentData = await recentRes.json();
    const tracks = recentData?.recenttracks?.track || [];

    const topTracksData = topTracksRes.ok ? await topTracksRes.json() : null;
    const topArtistsData = topArtistsRes.ok ? await topArtistsRes.json() : null;

    if (tracks.length === 0) {
      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate');
      return res.status(200).json({
        source: 'lastfm',
        playing: false,
        debug: { username: LASTFM_USERNAME, rawTrackCount: 0 },
        timestamp: new Date().toISOString()
      });
    }

    const [latest, ...rest] = tracks;
    const isNowPlaying = latest['@attr']?.nowplaying === 'true';

    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate');
    res.status(200).json({
      source: 'lastfm',
      playing: isNowPlaying,
      track: {
        name: latest.name,
        artist: latest.artist?.['#text'] || '',
        album: latest.album?.['#text'] || '',
        albumArt: latest.image?.find(img => img.size === 'extralarge')?.['#text'] || null,
        playedAt: latest.date?.uts ? new Date(Number(latest.date.uts) * 1000).toISOString() : null
      },
      recent: rest.slice(0, 5).map(track => ({
        name: track.name,
        artist: track.artist?.['#text'] || ''
      })),
      topTracks: (topTracksData?.toptracks?.track || []).map(track => ({
        name: track.name,
        artist: track.artist?.name || '',
        playcount: track.playcount
      })),
      topArtist: topArtistsData?.topartists?.artist?.[0]
        ? {
            name: topArtistsData.topartists.artist[0].name,
            playcount: topArtistsData.topartists.artist[0].playcount
          }
        : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
