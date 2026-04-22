import {
  clearAllProgress,
  hasActiveProfile,
  getActiveProfileName,
  loadSave,
  loadSettings,
  readHistory,
  saveSettings
} from './storage.js';
import { getUnifiedLeaderboardRows } from './leaderboard.js';
import {
  getSettings,
  getVolumeScale,
  sanitizePlayerName
} from './settings.js';
import {
  createAudio,
  safePlayAudio,
  safeRestartAudio,
  setAudioVolume,
  pauseAudio,
  stopAudio,
  unlockAudioContext
} from './audio.js';
import {
  createAccountWithEmail,
  loginWithEmail,
  logoutUser
} from './firebaseLeaderboard.js';

const HUB_MUSIC_FILE = 'Hub Music Track.mp3';
const REPORT_QUERY_BUTTON_IMAGE = 'Complaints Button.png';
const REPORT_QUERY_CLICK_SOUND_FILE = 'SHOTGUN Cock.wav';
const REPORT_QUERY_EMAIL = 'jameschipbutt@hotmail.com';
const REPORT_QUERY_WHATSAPP_URL = 'https://wa.me/447919248524';

const hubCellPositions = {
  date1: { x: 80.18, y: 23.43 },
  date2: { x: 80.18, y: 26.83 },
  date3: { x: 80.18, y: 29.87 },
  date4: { x: 80.18, y: 33.45 },
  date5: { x: 80.18, y: 36.14 },

  heist1: { x: 86.52, y: 23.43 },
  heist2: { x: 86.43, y: 26.65 },
  heist3: { x: 86.43, y: 30.05 },
  heist4: { x: 86.43, y: 33.45 },
  heist5: { x: 86.43, y: 35.96 },

  result1: { x: 91.8, y: 23.26 },
  result2: { x: 91.8, y: 26.65 },
  result3: { x: 91.8, y: 29.87 },
  result4: { x: 91.8, y: 33.27 },
  result5: { x: 91.8, y: 35.96 },

  instructionsBtn: { x: 59.08203125, y: 44.3649373881932, w: 7.12890625, h: 9.66010733452594 },
  leaderboardBtn: { x: 74.4140625, y: 58.318425760286225, w: 20.41015625, h: 10.01788908765653 },
  reportQueryBtn: { x: 78.125, y: 78.71198568872988, w: 12.98828125, h: 8.050089445438283 }
};

function formatMoney(pence) {
  return `£${((pence || 0) / 100).toFixed(2)}`;
}

function show(el) {
  if (el) el.classList.add('show');
}

function hide(el) {
  if (el) el.classList.remove('show');
}

function positionHubCells() {
  Object.entries(hubCellPositions).forEach(([id, pos]) => {
    const el = document.getElementById(id);
    if (!el) return;

    if ('w' in pos && 'h' in pos) {
      el.style.left = `${pos.x}%`;
      el.style.top = `${pos.y}%`;
      el.style.width = `${pos.w}%`;
      el.style.height = `${pos.h}%`;
      return;
    }

    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;
  });
}

function updateAppHeightVar() {
  const appHeight = Math.max(
    1,
    Math.round(
      window.visualViewport?.height ||
      window.innerHeight ||
      document.documentElement.clientHeight ||
      0
    )
  );

  document.documentElement.style.setProperty('--app-height', `${appHeight}px`);
}

function createHubMusic() {
  return createAudio(HUB_MUSIC_FILE, getVolumeScale(getSettings().hubVolume), true);
}

function getHubRefs() {
  return {
    hubScreen: document.getElementById('hubScreen'),
    gameScreen: document.getElementById('gameScreen'),

    instructionsBtn: document.getElementById('instructionsBtn'),
    instructionsOverlay: document.getElementById('instructionsOverlay'),
    closeInstructionsBtn: document.getElementById('closeInstructionsBtn'),

    settingsBtn: document.getElementById('settingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    playerNameInput: document.getElementById('playerNameInput'),
    hubVolumeInput: document.getElementById('hubVolumeInput'),
    hubVolumeValue: document.getElementById('hubVolumeValue'),
    gameMusicVolumeInput: document.getElementById('gameMusicVolumeInput'),
    gameMusicVolumeValue: document.getElementById('gameMusicVolumeValue'),
    voiceVolumeInput: document.getElementById('voiceVolumeInput'),
    voiceVolumeValue: document.getElementById('voiceVolumeValue'),
    difficultySelect: document.getElementById('difficultySelect'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    logoutProfileBtn: document.getElementById('logoutProfileBtn'),

    resetBtn: document.getElementById('resetProgressBtn'),
    resetConfirmOverlay: document.getElementById('resetConfirmOverlay'),
    confirmResetBtn: document.getElementById('confirmResetBtn'),
    cancelResetBtn: document.getElementById('cancelResetBtn'),

    leaderboardBtn: document.getElementById('leaderboardBtn'),
    reportQueryBtn: document.getElementById('reportQueryBtn'),
    reportQueryBtnImage: document.getElementById('reportQueryBtnImage'),

    reportQueryConfirmOverlay: document.getElementById('reportQueryConfirmOverlay'),
    reportQueryConfirmYesBtn: document.getElementById('reportQueryConfirmYesBtn'),
    reportQueryConfirmNoBtn: document.getElementById('reportQueryConfirmNoBtn'),

    leaderboardOverlay: document.getElementById('leaderboardOverlay'),
    closeLeaderboardBtn: document.getElementById('closeLeaderboardBtn'),
    closeLeaderboardFromBoardBtn: document.getElementById('closeLeaderboardFromBoardBtn'),
    showBestHeistBoardBtn: document.getElementById('showBestHeistBoardBtn'),
    showTotalBankedBoardBtn: document.getElementById('showTotalBankedBoardBtn'),
    swapLeaderboardBtn: document.getElementById('swapLeaderboardBtn'),
    backToLeaderboardMenuBtn: document.getElementById('backToLeaderboardMenuBtn'),
    leaderboardMenuScreen: document.getElementById('leaderboardMenuScreen'),
    leaderboardBoardScreen: document.getElementById('leaderboardBoardScreen'),
    leaderboardViewTitle: document.getElementById('leaderboardViewTitle'),
    leaderboardViewSubtitle: document.getElementById('leaderboardViewSubtitle'),
    leaderboardStatusText: document.getElementById('leaderboardStatusText'),
    leaderboardTable: document.getElementById('leaderboardTable'),
    leaderboardTableBody: document.getElementById('leaderboardTableBody'),

    startHeistBtn: document.getElementById('startHeistBtn'),
    activeProfileBadge: document.getElementById('activeProfileBadge'),

    totalBankedEl: document.getElementById('totalBanked'),
    bestHeistEl: document.getElementById('bestHeist'),
    heistsPlayedEl: document.getElementById('heistsPlayed'),
    paintingsStolenEl: document.getElementById('paintingsStolen'),

    dateEls: [
      document.getElementById('date1'),
      document.getElementById('date2'),
      document.getElementById('date3'),
      document.getElementById('date4'),
      document.getElementById('date5')
    ],

    heistEls: [
      document.getElementById('heist1'),
      document.getElementById('heist2'),
      document.getElementById('heist3'),
      document.getElementById('heist4'),
      document.getElementById('heist5')
    ],

    resultEls: [
      document.getElementById('result1'),
      document.getElementById('result2'),
      document.getElementById('result3'),
      document.getElementById('result4'),
      document.getElementById('result5')
    ],

    profileOverlay: document.getElementById('profileOverlay'),
    profileNameInput: document.getElementById('profileNameInput'),
    signupEmailInput: document.getElementById('signupEmailInput'),
    signupPasswordInput: document.getElementById('signupPasswordInput'),
    loginEmailInput: document.getElementById('loginEmailInput'),
    loginPasswordInput: document.getElementById('loginPasswordInput'),
    createProfileBtn: document.getElementById('createProfileBtn'),
    loginProfileBtn: document.getElementById('loginProfileBtn'),
    profileErrorText: document.getElementById('profileErrorText'),
    profileLoadingText: document.getElementById('profileLoadingText')
  };
}

function renderHubStats(refs) {
  const save = loadSave();
  refs.totalBankedEl.textContent = formatMoney(save.totalBanked);
  refs.bestHeistEl.textContent = formatMoney(save.bestHeist);
  refs.heistsPlayedEl.textContent = String(save.heistsPlayed || 0);
  refs.paintingsStolenEl.textContent = String(save.paintingsStolen || 0);
}

function renderHistory(refs) {
  const history = readHistory().slice(-5).reverse();

  for (let i = 0; i < 5; i += 1) {
    const entry = history[i];

    refs.dateEls[i].textContent = entry ? entry.date : '';
    refs.heistEls[i].textContent = entry ? String(entry.heistNumber) : '';
    refs.resultEls[i].textContent = entry ? (entry.success ? '✓' : '✕') : '';
    refs.resultEls[i].className =
      'hub-log-cell result' +
      (entry ? (entry.success ? ' success' : ' fail') : '');
  }
}

function refreshHub(refs) {
  renderHistory(refs);
  renderHubStats(refs);
}

function renderSettingsForm(refs) {
  const settings = loadSettings();
  const activeName = getActiveProfileName();

  refs.playerNameInput.value = activeName || settings.playerName || '';
  refs.playerNameInput.disabled = true;
  refs.playerNameInput.title = 'Username is managed by your account login.';

  refs.hubVolumeInput.value = String(settings.hubVolume);
  refs.hubVolumeValue.textContent = `${settings.hubVolume}%`;

  refs.gameMusicVolumeInput.value = String(settings.gameMusicVolume);
  refs.gameMusicVolumeValue.textContent = `${settings.gameMusicVolume}%`;

  refs.voiceVolumeInput.value = String(settings.voiceVolume);
  refs.voiceVolumeValue.textContent = `${settings.voiceVolume}%`;

  refs.difficultySelect.value = settings.difficulty;
}

function ensureUnifiedLeaderboardStyles() {
  if (document.getElementById('nanaheistUnifiedLeaderboardStyles')) return;

  const style = document.createElement('style');
  style.id = 'nanaheistUnifiedLeaderboardStyles';
  style.textContent = `
    #leaderboardPodium {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 14px 0 10px;
    }

    .leaderboard-podium-card {
      border-radius: 14px;
      background: rgba(255,255,255,0.34);
      border: 1px solid rgba(60,45,28,0.18);
      padding: 12px 10px;
      text-align: center;
      min-height: 112px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .leaderboard-podium-rank {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .leaderboard-podium-name {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 6px;
      word-break: break-word;
    }

    .leaderboard-podium-total,
    .leaderboard-podium-best {
      font-size: 13px;
      line-height: 1.4;
    }

    @media (max-width: 700px) {
      #leaderboardPodium {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensurePodiumContainer(refs) {
  let podium = document.getElementById('leaderboardPodium');
  if (podium) return podium;

  podium = document.createElement('div');
  podium.id = 'leaderboardPodium';

  const wrap = document.getElementById('leaderboardTableWrap');
  refs.leaderboardBoardScreen.insertBefore(podium, wrap);

  return podium;
}

function renderPodium(rows, refs) {
  const podium = ensurePodiumContainer(refs);
  const topThree = rows.slice(0, 3);

  if (!topThree.length) {
    podium.innerHTML = '';
    return;
  }

  podium.innerHTML = topThree
    .map((row) => `
      <div class="leaderboard-podium-card">
        <div class="leaderboard-podium-rank">#${row.rank}</div>
        <div class="leaderboard-podium-name">${row.name}</div>
        <div class="leaderboard-podium-total">Total Bank: <strong>${formatMoney(row.totalBanked)}</strong></div>
        <div class="leaderboard-podium-best">Best Heist: <strong>${formatMoney(row.bestHeist)}</strong></div>
      </div>
    `)
    .join('');
}

async function showUnifiedLeaderboard(refs) {
  refs.leaderboardMenuScreen.style.display = 'none';
  refs.leaderboardBoardScreen.style.display = 'block';

  refs.showBestHeistBoardBtn.style.display = 'none';
  refs.showTotalBankedBoardBtn.style.display = 'none';
  refs.closeLeaderboardBtn.style.display = 'none';
  refs.swapLeaderboardBtn.style.display = 'none';
  refs.backToLeaderboardMenuBtn.style.display = 'none';

  refs.leaderboardViewTitle.textContent = 'Family Leaderboard';
  refs.leaderboardViewSubtitle.textContent = 'Ranked by Total Bank, with Best Heist shown alongside';
  refs.closeLeaderboardFromBoardBtn.textContent = 'Return to Main Hub';

  const headCells = refs.leaderboardTable.querySelectorAll('thead th');
  if (headCells[0]) headCells[0].textContent = '#';
  if (headCells[1]) headCells[1].textContent = 'Name';
  if (headCells[2]) headCells[2].textContent = 'Total Bank';
  if (headCells[3]) headCells[3].textContent = 'Best Heist';

  refs.leaderboardStatusText.textContent = 'Loading leaderboard...';
  refs.leaderboardTableBody.innerHTML = '';
  renderPodium([], refs);
  show(refs.leaderboardOverlay);

  try {
    const rows = await getUnifiedLeaderboardRows();

    if (!rows.length) {
      refs.leaderboardStatusText.textContent = 'No leaderboard data yet.';
      refs.leaderboardTableBody.innerHTML = `
        <tr>
          <td class="leaderboard-empty" colspan="4">Nothing has been submitted yet.</td>
        </tr>
      `;
      renderPodium([], refs);
      return;
    }

    refs.leaderboardStatusText.textContent = '';
    renderPodium(rows, refs);

    refs.leaderboardTableBody.innerHTML = rows
      .map((row) => `
        <tr>
          <td class="leaderboard-rank">${row.rank}</td>
          <td>${row.name}</td>
          <td class="leaderboard-value">${formatMoney(row.totalBanked)}</td>
          <td class="leaderboard-value">${formatMoney(row.bestHeist)}</td>
        </tr>
      `)
      .join('');
  } catch (err) {
    console.error('Unified leaderboard failed:', err);
    refs.leaderboardStatusText.textContent = 'Could not load leaderboard right now.';
    refs.leaderboardTableBody.innerHTML = `
      <tr>
        <td class="leaderboard-empty" colspan="4">Try again in a moment.</td>
      </tr>
    `;
    renderPodium([], refs);
  }
}

export function initUI(options = {}) {
  const { onStartHeist } = options;
  const refs = getHubRefs();
  const hubMusic = createHubMusic();
  const reportQueryClickSound = REPORT_QUERY_CLICK_SOUND_FILE
    ? createAudio(REPORT_QUERY_CLICK_SOUND_FILE, getVolumeScale(getSettings().voiceVolume), false)
    : null;

  let musicUnlocked = false;
  let hubMusicSuppressed = false;
  let startHeistPending = false;
  let authLoggedIn = false;
  let creatingProfile = false;

  ensureUnifiedLeaderboardStyles();
  updateAppHeightVar();
  positionHubCells();
  refreshHub(refs);
  renderSettingsForm(refs);
  applyReportQueryButtonAsset();

  function setProfileError(message = '') {
    if (!refs.profileErrorText) return;
    refs.profileErrorText.textContent = message;
    refs.profileErrorText.style.display = message ? 'block' : 'none';
  }

  function applyHubVolume() {
    const settings = loadSettings();
    setAudioVolume(hubMusic, getVolumeScale(settings.hubVolume));
  }

  function pauseHubMusic(reset = false) {
    if (reset) {
      stopAudio(hubMusic);
      return;
    }

    pauseAudio(hubMusic);
  }

  function syncHubMusic() {
    const hubActive = refs.hubScreen?.classList.contains('active');
    const gameActive = refs.gameScreen?.classList.contains('active');

    if (!musicUnlocked) return;

    if (!hubActive || gameActive || hubMusicSuppressed || startHeistPending) {
      pauseHubMusic(true);
      return;
    }

    applyHubVolume();
    unlockAudioContext();

    if (hubMusic.paused || hubMusic.ended) {
      safePlayAudio(hubMusic);
    }
  }

  function applyReportQueryButtonAsset() {
    if (!refs.reportQueryBtnImage) return;

    refs.reportQueryBtnImage.src = `./${REPORT_QUERY_BUTTON_IMAGE}`;

    refs.reportQueryBtnImage.onerror = () => {
      refs.reportQueryBtnImage.style.display = 'none';
    };

    refs.reportQueryBtnImage.onload = () => {
      refs.reportQueryBtnImage.style.display = 'block';
    };
  }

  function closeReportQueryConfirm() {
    hide(refs.reportQueryConfirmOverlay);
  }

  function openReportQueryConfirm() {
    show(refs.reportQueryConfirmOverlay);
  }

  function continueToContact() {
    if (reportQueryClickSound) {
      setAudioVolume(reportQueryClickSound, getVolumeScale(loadSettings().voiceVolume));
      safeRestartAudio(reportQueryClickSound);
    }

    const destination = window.matchMedia('(pointer: coarse)').matches
      ? REPORT_QUERY_WHATSAPP_URL
      : `mailto:${REPORT_QUERY_EMAIL}`;

    window.setTimeout(() => {
      window.location.href = destination;
    }, reportQueryClickSound ? 120 : 0);
  }

  function ensureProfileBeforePlay() {
    if (authLoggedIn && hasActiveProfile()) return true;
    show(refs.profileOverlay);
    setProfileError('Log in before starting a heist.');
    return false;
  }

  async function createProfileFromInput() {
  if (creatingProfile) return;
  creatingProfile = true;
  setProfileError('');
  if (refs.profileLoadingText) refs.profileLoadingText.textContent = 'Creating account...';

  const displayName = sanitizePlayerName(refs.profileNameInput.value);
  const email = String(refs.signupEmailInput?.value || '').trim();
  const password = String(refs.signupPasswordInput?.value || '');

  const result = await createAccountWithEmail({ displayName, email, password });

  if (!result?.ok) {
    setProfileError(
      result?.reason === 'username_taken'
        ? 'That username is already taken.'
        : result?.reason === 'missing_credentials'
          ? 'Enter username, email and password.'
          : result?.reason === 'invalid_name'
            ? 'Enter a valid username.'
            : result?.reason === 'invalid_email'
              ? 'Enter a valid email address.'
              : result?.reason === 'weak_password'
                ? 'Password must be at least 6 characters.'
                : result?.reason === 'email_in_use'
                  ? 'That email address is already in use.'
                  : result?.reason === 'email_password_disabled'
                    ? 'Email/password sign-in is not enabled in Firebase.'
                    : result?.reason === 'profile_create_failed'
                      ? 'Account created, but profile setup failed.'
                      : 'Could not create that account right now.'
    );
    if (refs.profileLoadingText) refs.profileLoadingText.textContent = '';
    creatingProfile = false;
    return;
  }

  refs.profileNameInput.value = '';
  refs.signupEmailInput.value = '';
  refs.signupPasswordInput.value = '';
  if (refs.profileLoadingText) refs.profileLoadingText.textContent = '';
  setProfileError('');
  creatingProfile = false;
}

    refs.profileNameInput.value = '';
    refs.signupEmailInput.value = '';
    refs.signupPasswordInput.value = '';
    if (refs.profileLoadingText) refs.profileLoadingText.textContent = '';
    creatingProfile = false;
  }

  async function loginFromInput() {
    if (creatingProfile) return;
    creatingProfile = true;
    setProfileError('');
    if (refs.profileLoadingText) refs.profileLoadingText.textContent = 'Logging in...';

    const email = String(refs.loginEmailInput?.value || '').trim();
    const password = String(refs.loginPasswordInput?.value || '');

    const result = await loginWithEmail({ email, password });

    if (!result?.ok) {
      setProfileError('Could not log in with those details.');
      if (refs.profileLoadingText) refs.profileLoadingText.textContent = '';
      creatingProfile = false;
      return;
    }

    refs.loginEmailInput.value = '';
    refs.loginPasswordInput.value = '';
    if (refs.profileLoadingText) refs.profileLoadingText.textContent = '';
    creatingProfile = false;
  }

  document.addEventListener(
    'pointerdown',
    () => {
      musicUnlocked = true;
      unlockAudioContext();
    },
    { once: true }
  );

  document.addEventListener(
    'keydown',
    () => {
      musicUnlocked = true;
      unlockAudioContext();
    },
    { once: true }
  );

  const screenObserver = new MutationObserver(() => {
    syncHubMusic();
  });

  if (refs.hubScreen) {
    screenObserver.observe(refs.hubScreen, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  if (refs.gameScreen) {
    screenObserver.observe(refs.gameScreen, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  refs.instructionsBtn.addEventListener('click', () => show(refs.instructionsOverlay));
  refs.closeInstructionsBtn.addEventListener('click', () => hide(refs.instructionsOverlay));
  refs.instructionsOverlay.addEventListener('click', (e) => {
    if (e.target === refs.instructionsOverlay) hide(refs.instructionsOverlay);
  });

  refs.settingsBtn.addEventListener('click', () => {
    renderSettingsForm(refs);
    show(refs.settingsOverlay);
  });

  refs.closeSettingsBtn.addEventListener('click', () => hide(refs.settingsOverlay));
  refs.settingsOverlay.addEventListener('click', (e) => {
    if (e.target === refs.settingsOverlay) hide(refs.settingsOverlay);
  });

  refs.hubVolumeInput.addEventListener('input', () => {
    refs.hubVolumeValue.textContent = `${refs.hubVolumeInput.value}%`;
    setAudioVolume(hubMusic, getVolumeScale(refs.hubVolumeInput.value));
  });

  refs.gameMusicVolumeInput.addEventListener('input', () => {
    refs.gameMusicVolumeValue.textContent = `${refs.gameMusicVolumeInput.value}%`;
  });

  refs.voiceVolumeInput.addEventListener('input', () => {
    refs.voiceVolumeValue.textContent = `${refs.voiceVolumeInput.value}%`;
  });

  refs.saveSettingsBtn.addEventListener('click', () => {
    saveSettings({
      hubVolume: Number(refs.hubVolumeInput.value),
      gameMusicVolume: Number(refs.gameMusicVolumeInput.value),
      voiceVolume: Number(refs.voiceVolumeInput.value),
      difficulty: refs.difficultySelect.value
    });

    renderSettingsForm(refs);
    applyHubVolume();
    hide(refs.settingsOverlay);
  });

  if (refs.logoutProfileBtn) {
    refs.logoutProfileBtn.addEventListener('click', async () => {
      hide(refs.settingsOverlay);
      pauseHubMusic(true);
      await logoutUser();
      show(refs.profileOverlay);
      setProfileError('Logged out.');
    });
  }

  refs.resetBtn.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      show(refs.resetConfirmOverlay);
    },
    true
  );

  refs.cancelResetBtn.addEventListener('click', () => hide(refs.resetConfirmOverlay));

  refs.confirmResetBtn.addEventListener('click', () => {
    pauseHubMusic(true);
    clearAllProgress();
    location.reload();
  });

  refs.resetConfirmOverlay.addEventListener('click', (e) => {
    if (e.target === refs.resetConfirmOverlay) hide(refs.resetConfirmOverlay);
  });

  refs.leaderboardBtn.addEventListener('click', () => {
    showUnifiedLeaderboard(refs);
  });

  if (refs.reportQueryBtn) {
    refs.reportQueryBtn.addEventListener('click', openReportQueryConfirm);
    refs.reportQueryBtn.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        openReportQueryConfirm();
      },
      { passive: false }
    );
  }

  if (refs.reportQueryConfirmYesBtn) {
    refs.reportQueryConfirmYesBtn.addEventListener('click', () => {
      closeReportQueryConfirm();
      continueToContact();
    });
  }

  if (refs.reportQueryConfirmNoBtn) {
    refs.reportQueryConfirmNoBtn.addEventListener('click', closeReportQueryConfirm);
  }

  if (refs.reportQueryConfirmOverlay) {
    refs.reportQueryConfirmOverlay.addEventListener('click', (e) => {
      if (e.target === refs.reportQueryConfirmOverlay) {
        closeReportQueryConfirm();
      }
    });
  }

  refs.closeLeaderboardBtn.addEventListener('click', () => {
    hide(refs.leaderboardOverlay);
  });

  refs.closeLeaderboardFromBoardBtn.addEventListener('click', () => {
    hide(refs.leaderboardOverlay);
  });

  refs.leaderboardOverlay.addEventListener('click', (e) => {
    if (e.target === refs.leaderboardOverlay) hide(refs.leaderboardOverlay);
  });

  if (refs.createProfileBtn) {
    refs.createProfileBtn.addEventListener('click', createProfileFromInput);
  }

  if (refs.loginProfileBtn) {
    refs.loginProfileBtn.addEventListener('click', loginFromInput);
  }

  if (typeof onStartHeist === 'function') {
    const handleStartHeist = () => {
      if (!ensureProfileBeforePlay()) return;
      if (startHeistPending) return;

      startHeistPending = true;
      hubMusicSuppressed = true;
      pauseHubMusic(true);

      try {
        onStartHeist();
      } finally {
        setTimeout(() => {
          startHeistPending = false;
        }, 300);
      }
    };

    refs.startHeistBtn.addEventListener('click', handleStartHeist);
    refs.startHeistBtn.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        handleStartHeist();
      },
      { passive: false }
    );
  }

  window.addEventListener('nanaheist:data-updated', () => refreshHub(refs));

  window.addEventListener('nanaheist:settings-updated', () => {
    renderSettingsForm(refs);
    applyHubVolume();
  });

  window.addEventListener('nanaheist:auth-state', (event) => {
    const detail = event.detail || {};
    authLoggedIn = !!detail.loggedIn;
    const profileName = String(detail.profileName || '');

    if (refs.activeProfileBadge) {
      refs.activeProfileBadge.textContent = authLoggedIn
        ? `Profile: ${profileName}`
        : 'Not logged in';
    }

    if (refs.profileLoadingText) {
      refs.profileLoadingText.textContent = detail.loading ? 'Loading account...' : '';
    }

    if (detail.error) {
      setProfileError(detail.error);
    } else if (authLoggedIn) {
      setProfileError('');
      hide(refs.profileOverlay);
      renderSettingsForm(refs);
      refreshHub(refs);
      syncHubMusic();
    } else {
      show(refs.profileOverlay);
      renderSettingsForm(refs);
      refreshHub(refs);
    }
  });

  window.addEventListener('focus', () => {
    updateAppHeightVar();
    refreshHub(refs);
    syncHubMusic();
  });

  window.addEventListener('resize', () => {
    updateAppHeightVar();
    positionHubCells();
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      updateAppHeightVar();
      positionHubCells();
    }, 100);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateAppHeightVar);
    window.visualViewport.addEventListener('scroll', updateAppHeightVar);
  }

  applyHubVolume();
  renderSettingsForm(refs);
  refreshHub(refs);

  if (!hasActiveProfile()) {
    show(refs.profileOverlay);
    setProfileError('Log in or create an account to continue.');
  }

  return {
    refreshHub: () => refreshHub(refs),
    pauseHubMusic,
    syncHubMusic
  };
}
