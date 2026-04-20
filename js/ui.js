import {
  SAVE_KEY,
  HISTORY_KEY,
  clearAllProgress,
  loadSave,
  readHistory
} from './storage.js';
import { getLeaderboardRows } from './leaderboard.js';
import { getSettings, saveGameSettings, getVolumeScale } from './settings.js';

const HUB_MUSIC_FILE = 'Hub Music Track.mp3';

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
  result5: { x: 91.8, y: 35.96 }
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
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;
  });
}

function createHubMusic() {
  const audio = new Audio(HUB_MUSIC_FILE);
  audio.preload = 'auto';
  audio.loop = true;
  return audio;
}

function getLeaderboardMeta(type) {
  if (type === 'totalBanked') {
    return {
      title: 'Total Banked',
      subtitle: 'Highest total banked amounts',
      swapLabel: 'Show Best Heist'
    };
  }

  return {
    title: 'Best Heist',
    subtitle: 'Highest single-heist values',
    swapLabel: 'Show Total Banked'
  };
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

    resetBtn: document.getElementById('resetProgressBtn'),
    resetConfirmOverlay: document.getElementById('resetConfirmOverlay'),
    confirmResetBtn: document.getElementById('confirmResetBtn'),
    cancelResetBtn: document.getElementById('cancelResetBtn'),

    leaderboardBtn: document.getElementById('leaderboardBtn'),
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
    leaderboardTableBody: document.getElementById('leaderboardTableBody'),

    startHeistBtn: document.getElementById('startHeistBtn'),

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
    ]
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
  const settings = getSettings();
  refs.playerNameInput.value = settings.playerName;
  refs.hubVolumeInput.value = String(settings.hubVolume);
  refs.hubVolumeValue.textContent = `${settings.hubVolume}%`;
  refs.gameMusicVolumeInput.value = String(settings.gameMusicVolume);
  refs.gameMusicVolumeValue.textContent = `${settings.gameMusicVolume}%`;
  refs.voiceVolumeInput.value = String(settings.voiceVolume);
  refs.voiceVolumeValue.textContent = `${settings.voiceVolume}%`;
  refs.difficultySelect.value = settings.difficulty;
}

function showLeaderboardMenu(refs) {
  refs.leaderboardMenuScreen.style.display = 'block';
  refs.leaderboardBoardScreen.style.display = 'none';
  refs.leaderboardStatusText.textContent = '';
  refs.leaderboardTableBody.innerHTML = '';
  show(refs.leaderboardOverlay);
}

async function showLeaderboardBoard(refs, type) {
  const meta = getLeaderboardMeta(type);

  refs.leaderboardMenuScreen.style.display = 'none';
  refs.leaderboardBoardScreen.style.display = 'block';
  refs.leaderboardViewTitle.textContent = meta.title;
  refs.leaderboardViewSubtitle.textContent = meta.subtitle;
  refs.swapLeaderboardBtn.textContent = meta.swapLabel;
  refs.swapLeaderboardBtn.dataset.boardType = type === 'bestHeist' ? 'totalBanked' : 'bestHeist';

  refs.leaderboardStatusText.textContent = 'Loading leaderboard...';
  refs.leaderboardTableBody.innerHTML = '';
  show(refs.leaderboardOverlay);

  const rows = await getLeaderboardRows(type);

  if (!rows.length) {
    refs.leaderboardStatusText.textContent = 'No leaderboard data yet.';
    refs.leaderboardTableBody.innerHTML = `
      <tr>
        <td class="leaderboard-empty" colspan="4">Nothing has been submitted yet.</td>
      </tr>
    `;
    return;
  }

  refs.leaderboardStatusText.textContent = '';

  refs.leaderboardTableBody.innerHTML = rows
    .map((row, index) => {
      const name = row.name || 'Unknown';
      const value = formatMoney(Number(row.value || 0));
      const extra = row.extra || '';
      const rank = row.rank || index + 1;

      return `
        <tr>
          <td class="leaderboard-rank">${rank}</td>
          <td>${name}</td>
          <td class="leaderboard-value">${value}</td>
          <td>${extra}</td>
        </tr>
      `;
    })
    .join('');
}

export function initUI(options = {}) {
  const { onStartHeist } = options;
  const refs = getHubRefs();
  const hubMusic = createHubMusic();

  let musicUnlocked = false;

  positionHubCells();
  refreshHub(refs);
  renderSettingsForm(refs);

  function applyHubVolume() {
    const settings = getSettings();
    hubMusic.volume = getVolumeScale(settings.hubVolume);
  }

  function pauseHubMusic() {
    try {
      hubMusic.pause();
      hubMusic.currentTime = 0;
    } catch (_) {}
  }

  function syncHubMusic() {
    const hubActive = refs.hubScreen?.classList.contains('active');

    if (!hubActive) {
      pauseHubMusic();
      return;
    }

    if (!musicUnlocked) return;

    applyHubVolume();

    try {
      const playPromise = hubMusic.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } catch (_) {}
  }

  function unlockHubMusic() {
    musicUnlocked = true;
    syncHubMusic();
  }

  document.addEventListener('pointerdown', unlockHubMusic, { once: true });
  document.addEventListener('keydown', unlockHubMusic, { once: true });

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
    hubMusic.volume = getVolumeScale(refs.hubVolumeInput.value);
  });

  refs.gameMusicVolumeInput.addEventListener('input', () => {
    refs.gameMusicVolumeValue.textContent = `${refs.gameMusicVolumeInput.value}%`;
  });

  refs.voiceVolumeInput.addEventListener('input', () => {
    refs.voiceVolumeValue.textContent = `${refs.voiceVolumeInput.value}%`;
  });

  refs.saveSettingsBtn.addEventListener('click', () => {
    saveGameSettings({
      playerName: refs.playerNameInput.value,
      hubVolume: refs.hubVolumeInput.value,
      gameMusicVolume: refs.gameMusicVolumeInput.value,
      voiceVolume: refs.voiceVolumeInput.value,
      difficulty: refs.difficultySelect.value
    });

    renderSettingsForm(refs);
    applyHubVolume();
    hide(refs.settingsOverlay);
  });

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
    pauseHubMusic();
    clearAllProgress();
    location.reload();
  });

  refs.resetConfirmOverlay.addEventListener('click', (e) => {
    if (e.target === refs.resetConfirmOverlay) hide(refs.resetConfirmOverlay);
  });

  refs.leaderboardBtn.addEventListener('click', () => {
    showLeaderboardMenu(refs);
  });

  refs.showBestHeistBoardBtn.addEventListener('click', () => {
    showLeaderboardBoard(refs, 'bestHeist');
  });

  refs.showTotalBankedBoardBtn.addEventListener('click', () => {
    showLeaderboardBoard(refs, 'totalBanked');
  });

  refs.swapLeaderboardBtn.addEventListener('click', () => {
    const nextType = refs.swapLeaderboardBtn.dataset.boardType || 'bestHeist';
    showLeaderboardBoard(refs, nextType);
  });

  refs.backToLeaderboardMenuBtn.addEventListener('click', () => {
    showLeaderboardMenu(refs);
  });

  refs.closeLeaderboardBtn.addEventListener('click', () => {
    hide(refs.leaderboardOverlay);
  });

  refs.closeLeaderboardFromBoardBtn.addEventListener('click', () => {
    hide(refs.leaderboardOverlay);
  });

  refs.leaderboardOverlay.addEventListener('click', (e) => {
    if (e.target === refs.leaderboardOverlay) hide(refs.leaderboardOverlay);
  });

  if (typeof onStartHeist === 'function') {
    const handleStartHeist = () => {
      pauseHubMusic();
      onStartHeist();
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

  window.addEventListener('storage', (e) => {
    if (e.key === SAVE_KEY || e.key === HISTORY_KEY) {
      refreshHub(refs);
    }
  });

  window.addEventListener('focus', () => {
    refreshHub(refs);
    syncHubMusic();
  });

  applyHubVolume();
  syncHubMusic();

  return {
    refreshHub: () => refreshHub(refs),
    pauseHubMusic,
    syncHubMusic,
    showInstructions: () => show(refs.instructionsOverlay),
    hideInstructions: () => hide(refs.instructionsOverlay),
    showLeaderboards: () => showLeaderboardMenu(refs)
  };
}
