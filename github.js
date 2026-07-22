// GET /api/github
// Returns recent public commits, pulled from GitHub's public events
// feed for the account. Surfaces the real error/status on failure
// so token/permission issues are visible instead of silently empty.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nmethylpyrrolinium.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { GITHUB_TOKEN } = process.env;
  const username = 'nmethylpyrrolinium';

  try {
    const response = await fetch(`https://api.github.com/users/${username}/events/public`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'arpeggios-api',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({
        error: `GitHub API returned ${response.status}`,
        debug: {
          hasToken: Boolean(GITHUB_TOKEN),
          rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
          body: body.slice(0, 400)
        }
      });
    }

    const events = await response.json();

    const pushEvents = events.filter(event => event.type === 'PushEvent');

    const commits = pushEvents
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
      debug: {
        totalEventsFetched: events.length,
        pushEventsFound: pushEvents.length,
        note: commits.length === 0
          ? 'No PushEvents in your recent public activity — GitHub only shows the last ~90 days / 300 events, and private repo commits never appear here unless the repo is public.'
          : undefined
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
