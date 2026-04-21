export const SAVE_KEY = 'nanaHeistCloudSave_v1';
export const LAST_HEIST_WRONG_KEY = 'nanaHeistCloudWrong_v1';
export const HISTORY_KEY = 'nanaHeistCloudHistory_v1';
export const SETTINGS_KEY = 'nanaHeistCloudSettings_v1';

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

const state = {
  ready: false,
  profileName: '',
  save: getDefaultSave(),
  settings: getDefaultSettings(),
  history: [],
  lastHeistWrong: []
};

function dispatchDataUpdated() {
  window.dispatchEvent(new CustomEvent('nanaheist:data-updated'));
}

function dispatchSettingsUpdated() {
  window.dispatchEvent(new CustomEvent('nanaheist:settings-updated'));
}

function queueCloudWrite() {
  if (typeof window.nanaHeistQueueCloudWrite === 'function') {
    window.nanaHeistQueueCloudWrite();
  }
}

export function hydrateCloudProfile(profileDoc = {}) {
  state.ready = true;
  state.profileName = String(profileDoc.displayName || '');

  const incomingSave = profileDoc.save || {};
  state.save = {
    totalBanked: Number(incomingSave.totalBanked || 0),
    bestHeist: Number(incomingSave.bestHeist || 0),
    heistsPlayed: Number(incomingSave.heistsPlayed || 0),
    paintingsStolen: Number(incomingSave.paintingsStolen || 0),
    usedQuestionIds: Array.isArray(incomingSave.usedQuestionIds) ? incomingSave.usedQuestionIds : []
  };

  const incomingSettings = profileDoc.settings || {};
  const defaults = getDefaultSettings();
  state.settings = {
    playerName: state.profileName,
    hubVolume: Number(incomingSettings.hubVolume ?? defaults.hubVolume),
    gameMusicVolume: Number(incomingSettings.gameMusicVolume ?? defaults.gameMusicVolume),
    voiceVolume: Number(incomingSettings.voiceVolume ?? defaults.voiceVolume),
    difficulty: ['easy', 'medium', 'hard'].includes(incomingSettings.difficulty)
      ? incomingSettings.difficulty
      : defaults.difficulty
  };

  state.history = Array.isArray(profileDoc.history) ? profileDoc.history : [];
  state.lastHeistWrong = Array.isArray(profileDoc.lastHeistWrong) ? profileDoc.lastHeistWrong : [];

  dispatchDataUpdated();
  dispatchSettingsUpdated();
}

export function clearCloudProfile() {
  state.ready = false;
  state.profileName = '';
  state.save = getDefaultSave();
  state.settings = getDefaultSettings();
  state.history = [];
  state.lastHeistWrong = [];

  dispatchDataUpdated();
  dispatchSettingsUpdated();
}

export function buildCloudProfilePayload() {
  return {
    displayName: state.profileName,
    save: { ...state.save },
    settings: {
      ...state.settings,
      playerName: state.profileName
    },
    history: [...state.history],
    lastHeistWrong: [...state.lastHeistWrong]
  };
}

export function hasActiveProfile() {
  return !!state.profileName;
}

export function getActiveProfileName() {
  return state.profileName;
}

export function loadSave() {
  return { ...state.save, usedQuestionIds: [...state.save.usedQuestionIds] };
}

export function saveProgress(saveData) {
  state.save = {
    totalBanked: Number(saveData?.totalBanked || 0),
    bestHeist: Number(saveData?.bestHeist || 0),
    heistsPlayed: Number(saveData?.heistsPlayed || 0),
    paintingsStolen: Number(saveData?.paintingsStolen || 0),
    usedQuestionIds: Array.isArray(saveData?.usedQuestionIds) ? saveData.usedQuestionIds : []
  };
  dispatchDataUpdated();
  queueCloudWrite();
}

export function loadSettings() {
  return {
    ...state.settings,
    playerName: state.profileName || state.settings.playerName || ''
  };
}

export function saveSettings(settings) {
  state.settings = {
    ...state.settings,
    ...settings,
    playerName: state.profileName || state.settings.playerName || ''
  };
  dispatchSettingsUpdated();
  queueCloudWrite();
}

export function loadLastHeistWrong() {
  return Array.isArray(state.lastHeistWrong) ? [...state.lastHeistWrong] : [];
}

export function saveLastHeistWrong(items) {
  state.lastHeistWrong = Array.isArray(items) ? items : [];
  dispatchDataUpdated();
  queueCloudWrite();
}

export function clearLastHeistWrong() {
  state.lastHeistWrong = [];
  dispatchDataUpdated();
  queueCloudWrite();
}

export function readHistory() {
  return Array.isArray(state.history) ? [...state.history] : [];
}

export function writeHistory(history) {
  state.history = Array.isArray(history) ? history : [];
  dispatchDataUpdated();
  queueCloudWrite();
}

export function formatDateShort(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function appendHistoryEntry({ heistNumber, success, date = formatDateShort() }) {
  const history = readHistory();
  history.push({ date, heistNumber, success: !!success });
  writeHistory(history.slice(-50));
}

export function clearAllProgress() {
  clearCloudProfile();
}
