export const SAVE_KEY = 'nanaHeistSave_v12';
export const LAST_HEIST_WRONG_KEY = 'nanaHeistLastWrong_v12';
export const HISTORY_KEY = 'nanaHeistHistory_v1';
export const SETTINGS_KEY = 'nanaHeistSettings_v1';
export const PROFILES_KEY = 'nanaHeistProfiles_v1';
export const ACTIVE_PROFILE_KEY = 'nanaHeistActiveProfile_v1';

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

function getDefaultProfile(name = '') {
  return {
    name: String(name || ''),
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
    save: getDefaultSave(),
    settings: {
      ...getDefaultSettings(),
      playerName: String(name || '')
    },
    history: [],
    lastHeistWrong: []
  };
}

function getDefaultProfilesState() {
  return {
    profiles: {}
  };
}

function normaliseProfileKey(name) {
  return String(name || '').trim().toLowerCase();
}

function dispatchDataUpdated() {
  window.dispatchEvent(new CustomEvent('nanaheist:data-updated'));
}

function dispatchSettingsUpdated() {
  window.dispatchEvent(new CustomEvent('nanaheist:settings-updated'));
}

function readProfilesState() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return getDefaultProfilesState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.profiles !== 'object') {
      return getDefaultProfilesState();
    }
    return parsed;
  } catch {
    return getDefaultProfilesState();
  }
}

function writeProfilesState(state) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(state));
}

function getActiveProfileKey() {
  return normaliseProfileKey(localStorage.getItem(ACTIVE_PROFILE_KEY) || '');
}

function readActiveProfileRecord() {
  const state = readProfilesState();
  const activeKey = getActiveProfileKey();
  if (!activeKey) return null;
  const profile = state.profiles?.[activeKey];
  return profile && typeof profile === 'object' ? { key: activeKey, profile, state } : null;
}

function writeActiveProfilePart(part, value) {
  const active = readActiveProfileRecord();
  if (!active) return;
  active.profile[part] = value;
  active.profile.lastPlayedAt = Date.now();
  writeProfilesState(active.state);
}

export function hasActiveProfile() {
  return !!readActiveProfileRecord();
}

export function getActiveProfileName() {
  return readActiveProfileRecord()?.profile?.name || '';
}

export function listProfiles() {
  const state = readProfilesState();
  return Object.entries(state.profiles)
    .map(([key, profile]) => ({
      key,
      name: String(profile?.name || ''),
      createdAt: Number(profile?.createdAt || 0),
      lastPlayedAt: Number(profile?.lastPlayedAt || 0),
      totalBanked: Number(profile?.save?.totalBanked || 0),
      bestHeist: Number(profile?.save?.bestHeist || 0),
      heistsPlayed: Number(profile?.save?.heistsPlayed || 0)
    }))
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt || a.name.localeCompare(b.name));
}

export function isProfileStored(name) {
  const key = normaliseProfileKey(name);
  if (!key) return false;
  return !!readProfilesState().profiles[key];
}

export function createProfile(name) {
  const safeName = String(name || '').trim();
  const key = normaliseProfileKey(safeName);
  if (!safeName || !key) return { ok: false, reason: 'invalid_name' };

  const state = readProfilesState();
  if (state.profiles[key]) return { ok: false, reason: 'name_taken_local' };

  state.profiles[key] = getDefaultProfile(safeName);
  writeProfilesState(state);
  localStorage.setItem(ACTIVE_PROFILE_KEY, key);
  dispatchDataUpdated();
  dispatchSettingsUpdated();
  return { ok: true, profile: state.profiles[key] };
}

export function loginToProfile(name) {
  const key = normaliseProfileKey(name);
  const state = readProfilesState();
  const profile = state.profiles[key];
  if (!profile) return { ok: false, reason: 'profile_not_found' };
  profile.lastPlayedAt = Date.now();
  writeProfilesState(state);
  localStorage.setItem(ACTIVE_PROFILE_KEY, key);
  dispatchDataUpdated();
  dispatchSettingsUpdated();
  return { ok: true, profile };
}

export function logoutActiveProfile() {
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
  dispatchDataUpdated();
  dispatchSettingsUpdated();
}

export function loadSave() {
  const active = readActiveProfileRecord();
  if (!active) return getDefaultSave();
  const parsed = active.profile.save || {};
  return {
    totalBanked: Number(parsed.totalBanked || 0),
    bestHeist: Number(parsed.bestHeist || 0),
    heistsPlayed: Number(parsed.heistsPlayed || 0),
    paintingsStolen: Number(parsed.paintingsStolen || 0),
    usedQuestionIds: Array.isArray(parsed.usedQuestionIds) ? parsed.usedQuestionIds : []
  };
}

export function saveProgress(saveData) {
  writeActiveProfilePart('save', saveData);
  dispatchDataUpdated();
}

export function loadSettings() {
  const active = readActiveProfileRecord();
  if (!active) return getDefaultSettings();

  const parsed = active.profile.settings || {};
  const defaults = getDefaultSettings();
  return {
    playerName: String(active.profile.name || parsed.playerName || defaults.playerName),
    hubVolume: Number(parsed.hubVolume ?? defaults.hubVolume),
    gameMusicVolume: Number(parsed.gameMusicVolume ?? defaults.gameMusicVolume),
    voiceVolume: Number(parsed.voiceVolume ?? defaults.voiceVolume),
    difficulty: ['easy', 'medium', 'hard'].includes(parsed.difficulty)
      ? parsed.difficulty
      : defaults.difficulty
  };
}

export function saveSettings(settings) {
  const current = loadSettings();
  writeActiveProfilePart('settings', {
    ...current,
    ...settings,
    playerName: getActiveProfileName() || String(settings.playerName || current.playerName || '')
  });
  dispatchSettingsUpdated();
}

export function loadLastHeistWrong() {
  const active = readActiveProfileRecord();
  if (!active) return [];
  const parsed = active.profile.lastHeistWrong;
  return Array.isArray(parsed) ? parsed : [];
}

export function saveLastHeistWrong(items) {
  writeActiveProfilePart('lastHeistWrong', Array.isArray(items) ? items : []);
  dispatchDataUpdated();
}

export function clearLastHeistWrong() {
  writeActiveProfilePart('lastHeistWrong', []);
  dispatchDataUpdated();
}

export function readHistory() {
  const active = readActiveProfileRecord();
  if (!active) return [];
  const parsed = active.profile.history;
  return Array.isArray(parsed) ? parsed : [];
}

export function writeHistory(history) {
  writeActiveProfilePart('history', Array.isArray(history) ? history : []);
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
  history.push({ date, heistNumber, success: !!success });
  writeHistory(history.slice(-50));
}

export function clearAllProgress() {
  localStorage.removeItem(PROFILES_KEY);
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(LAST_HEIST_WRONG_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  dispatchDataUpdated();
  dispatchSettingsUpdated();
}
