export const SAVE_KEY = 'nanaHeistSave_v12';
export const LAST_HEIST_WRONG_KEY = 'nanaHeistLastWrong_v12';
export const HISTORY_KEY = 'nanaHeistHistory_v1';
export const SETTINGS_KEY = 'nanaHeistSettings_v1';

function getDefaultSave() {
  return {
    totalBanked: 0,
    bestHeist: 0,
    heistsPlayed: 0,
    paintingsStolen: 0,
    usedQuestionIds: []
  };
}

export function getDefaultSettings() {
  return {
    playerName: '',
    hubVolume: 22,
    gameMusicVolume: 22,
    voiceVolume: 90,
    difficulty: 'medium'
  };
}

function dispatchDataUpdated() {
  window.dispatchEvent(new CustomEvent('nanaheist:data-updated'));
}

function dispatchSettingsUpdated() {
  window.dispatchEvent(new CustomEvent('nanaheist:settings-updated'));
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return getDefaultSave();

    const parsed = JSON.parse(raw);

    return {
      totalBanked: Number(parsed.totalBanked || 0),
      bestHeist: Number(parsed.bestHeist || 0),
      heistsPlayed: Number(parsed.heistsPlayed || 0),
      paintingsStolen: Number(parsed.paintingsStolen || 0),
      usedQuestionIds: Array.isArray(parsed.usedQuestionIds) ? parsed.usedQuestionIds : []
    };
  } catch {
    return getDefaultSave();
  }
}

export function saveProgress(saveData) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  dispatchDataUpdated();
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return getDefaultSettings();

    const parsed = JSON.parse(raw);
    const defaults = getDefaultSettings();

    return {
      playerName: String(parsed.playerName || defaults.playerName),
      hubVolume: Number(parsed.hubVolume ?? defaults.hubVolume),
      gameMusicVolume: Number(parsed.gameMusicVolume ?? defaults.gameMusicVolume),
      voiceVolume: Number(parsed.voiceVolume ?? defaults.voiceVolume),
      difficulty: ['easy', 'medium', 'hard'].includes(parsed.difficulty)
        ? parsed.difficulty
        : defaults.difficulty
    };
  } catch {
    return getDefaultSettings();
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  dispatchSettingsUpdated();
}

export function loadLastHeistWrong() {
  try {
    const raw = localStorage.getItem(LAST_HEIST_WRONG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLastHeistWrong(items) {
  localStorage.setItem(LAST_HEIST_WRONG_KEY, JSON.stringify(items || []));
  dispatchDataUpdated();
}

export function clearLastHeistWrong() {
  localStorage.removeItem(LAST_HEIST_WRONG_KEY);
  dispatchDataUpdated();
}

export function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(Array.isArray(history) ? history : []));
  dispatchDataUpdated();
}

export function formatDateShort(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function appendHistoryEntry({ heistNumber, success, date = formatDateShort() }) {
  const history = readHistory();

  history.push({
    date,
    heistNumber,
    success: !!success
  });

  writeHistory(history.slice(-50));
}

export function clearAllProgress() {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(LAST_HEIST_WRONG_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  dispatchDataUpdated();
  dispatchSettingsUpdated();
}
