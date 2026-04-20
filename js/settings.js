import { loadSettings, saveSettings } from './storage.js';

const BANNED_NAME_PARTS = [
  'fuck',
  'shit',
  'cunt',
  'bitch',
  'twat',
  'wank',
  'slut',
  'whore',
  'retard',
  'spastic',
  'fag',
  'nigger',
  'nigga'
];

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

export function sanitizePlayerName(rawName) {
  const cleaned = String(rawName ?? '')
    .replace(/[<>]/g, '')
    .replace(/[^A-Za-z0-9 '\-_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);

  if (!cleaned) return '';

  const lowered = cleaned.toLowerCase();
  if (BANNED_NAME_PARTS.some((word) => lowered.includes(word))) {
    return 'Player';
  }

  return cleaned;
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
    playerName: sanitizePlayerName(nextSettings.playerName ?? current.playerName)
  };

  saveSettings(merged);
  return merged;
}

export function getVolumeScale(percent) {
  return clampPercent(percent) / 100;
}
