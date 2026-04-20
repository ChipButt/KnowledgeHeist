import { loadSettings, saveSettings } from './storage.js';

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

export function getSettings() {
  return loadSettings();
}

export function saveGameSettings(nextSettings) {
  const current = loadSettings();

  const merged = {
    ...current,
    ...nextSettings,
    hubVolume: clampPercent(nextSettings.hubVolume ?? current.hubVolume),
    gameMusicVolume: clampPercent(nextSettings.gameMusicVolume ?? current.gameMusicVolume),
    voiceVolume: clampPercent(nextSettings.voiceVolume ?? current.voiceVolume),
    difficulty: ['easy', 'medium', 'hard'].includes(nextSettings.difficulty)
      ? nextSettings.difficulty
      : current.difficulty,
    playerName: String(nextSettings.playerName ?? current.playerName).trim()
  };

  saveSettings(merged);
  return merged;
}

export function getVolumeScale(percent) {
  return clampPercent(percent) / 100;
}
