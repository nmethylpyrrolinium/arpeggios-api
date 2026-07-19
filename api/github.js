// GET /api/github
// Returns your most recent public commits across all repos, pulled from
// GitHub's public events feed. No repo names are hardcoded, so this stays
// correct even as you add/rename/retire projects.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nmethylpyrrolinium.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const username = 'nmethylpyrrolinium';
    const response = await fetch(`https://api.github.com/users/${username}/events/public`, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'arpeggios-api'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API returned ${response.status}` });
    }

    const events = await response.json();

    const commits = events
      .filter(event => event.type === 'PushEvent')
      .flatMap(event =>
        (event.payload.commits || []).map(commit => ({
          repo: event.repo.name.split('/')[1],
          message: commit.message,
          timestamp: event.created_at,
          url: `https://github.com/${event.repo.name}/commit/${commit.sha}`
        }))
      )
      .slice(0, 10);

    res.setHeader('Cache-Control', 's-maxage=1500, stale-while-revalidate');
    res.status(200).json({
      source: 'github',
      commits,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
