import { loadSave, loadSettings } from './storage.js';

function formatMoney(pence) {
  return `£${((pence || 0) / 100).toFixed(2)}`;
}

function getPlayerName() {
  const settings = loadSettings();
  return settings.playerName || 'Local Player';
}

function getFallbackLeaderboardRows(type) {
  const save = loadSave();
  const playerName = getPlayerName();

  if (type === 'bestHeist') {
    if (!save.bestHeist) return [];
    return [
      {
        name: playerName,
        value: save.bestHeist,
        extra: `Total Banked ${formatMoney(save.totalBanked)}`
      }
    ];
  }

  if (!save.totalBanked) return [];
  return [
    {
      name: playerName,
      value: save.totalBanked,
      extra: `Best Heist ${formatMoney(save.bestHeist)}`
    }
  ];
}

export async function getLeaderboardRows(type) {
  if (typeof window.nanaHeistLeaderboardProvider === 'function') {
    try {
      const rows = await window.nanaHeistLeaderboardProvider(type);
      if (Array.isArray(rows)) return rows;
    } catch (err) {
      console.error('Leaderboard provider failed:', err);
    }
  }

  return getFallbackLeaderboardRows(type);
}
