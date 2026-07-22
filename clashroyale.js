// GET /api/clashroyale
// Returns trophies, deck (with card art), and recent battles.
// Routed through RoyaleAPI's proxy since Vercel has no fixed
// outbound IP for Supercell's IP-locked keys.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nmethylpyrrolinium.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { CLASH_API_KEY, CLASH_PLAYER_TAG } = process.env;

  try {
    const rawTag = CLASH_PLAYER_TAG.startsWith('#') ? CLASH_PLAYER_TAG.slice(1) : CLASH_PLAYER_TAG;
    const encodedTag = `%23${rawTag}`;
    const base = 'https://proxy.royaleapi.dev/v1';
    const headers = { Authorization: `Bearer ${CLASH_API_KEY}`, Accept: 'application/json' };

    const [playerRes, battleRes] = await Promise.all([
      fetch(`${base}/players/${encodedTag}`, { headers }),
      fetch(`${base}/players/${encodedTag}/battlelog`, { headers })
    ]);

    if (!playerRes.ok) {
      return res.status(playerRes.status).json({
        error: `Clash Royale API returned ${playerRes.status}`,
        debug: { tagUsedRaw: CLASH_PLAYER_TAG, tagUsedEncoded: encodedTag, urlHit: `${base}/players/${encodedTag}` }
      });
    }

    const player = await playerRes.json();
    const battles = battleRes.ok ? await battleRes.json() : [];

    res.setHeader('Cache-Control', 's-maxage=1500, stale-while-revalidate');
    res.status(200).json({
      source: 'clash_royale',
      player: {
        name: player.name,
        trophies: player.trophies,
        bestTrophies: player.bestTrophies,
        level: player.expLevel,
        arena: player.arena?.name || '',
        arenaIcon: player.arena?.iconUrls?.icon || null,
        wins: player.wins,
        losses: player.losses,
        clan: player.clan?.name || null,
        deck: (player.currentDeck || []).map(card => ({
          name: card.name,
          level: card.level,
          iconUrl: card.iconUrls?.medium || null
        })),
        supportCards: (player.currentDeckSupportCards || []).map(card => ({
          name: card.name,
          iconUrl: card.iconUrls?.medium || null
        }))
      },
      recentBattles: (Array.isArray(battles) ? battles : []).slice(0, 5).map(battle => ({
        timestamp: battle.battleTime,
        type: battle.type,
        opponent: battle.opponent?.[0]?.name || 'Unknown',
        opponentCrest: battle.opponent?.[0]?.clan?.badgeId || null,
        crownsFor: battle.team?.[0]?.crowns ?? 0,
        crownsAgainst: battle.opponent?.[0]?.crowns ?? 0,
        won: (battle.team?.[0]?.crowns ?? 0) > (battle.opponent?.[0]?.crowns ?? 0)
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
