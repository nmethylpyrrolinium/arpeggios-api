// GET /api/status
// Visit this URL directly after deploying to confirm the backend is live
// and which environment variables it can actually see (never the values
// themselves — just whether each one is present).

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nmethylpyrrolinium.github.io');

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    envVarsPresent: {
      GITHUB_TOKEN: Boolean(process.env.GITHUB_TOKEN),
      LASTFM_API_KEY: Boolean(process.env.LASTFM_API_KEY),
      LASTFM_USERNAME: Boolean(process.env.LASTFM_USERNAME),
      CLASH_API_KEY: Boolean(process.env.CLASH_API_KEY),
      CLASH_PLAYER_TAG: Boolean(process.env.CLASH_PLAYER_TAG)
    }
  });
}

