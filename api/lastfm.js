// GET /api/lastfm
// Returns your currently-playing track (if any) plus recent listening
// history, sourced from Last.fm's public recent-tracks endpoint.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nmethylpyrrolinium.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { LASTFM_API_KEY, LASTFM_USERNAME } = process.env;
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(LASTFM_USERNAME)}&api_key=${LASTFM_API_KEY}&format=json&limit=5`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Last.fm API returned ${response.status}` });
    }

    const data = await response.json();
    const tracks = data?.recenttracks?.track || [];

    if (tracks.length === 0) {
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
      return res.status(200).json({ source: 'lastfm', playing: false, timestamp: new Date().toISOString() });
    }

    const [latest, ...rest] = tracks;
    const isNowPlaying = latest['@attr']?.nowplaying === 'true';

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
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
      recent: rest.slice(0, 4).map(track => ({
        name: track.name,
        artist: track.artist?.['#text'] || ''
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

