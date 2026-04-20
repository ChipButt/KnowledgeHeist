import { loadSave, loadSettings } from './storage.js';
import { sanitizePlayerName } from './settings.js';

export async function getUnifiedLeaderboardRows() {
  if (typeof window.nanaHeistUnifiedLeaderboardProvider === 'function') {
    try {
      const rows = await window.nanaHeistUnifiedLeaderboardProvider();
      if (Array.isArray(rows)) return rows;
    } catch (err) {
      console.error('Unified leaderboard provider failed:', err);
    }
  }

  const save = loadSave();
  const settings = loadSettings();

  if (!save.totalBanked && !save.bestHeist) return [];

  return [
    {
      rank: 1,
      name: sanitizePlayerName(settings.playerName) || 'Local Player',
      totalBanked: Number(save.totalBanked || 0),
      bestHeist: Number(save.bestHeist || 0),
      heistsPlayed: Number(save.heistsPlayed || 0),
      paintingsStolen: Number(save.paintingsStolen || 0)
    }
  ];
}
