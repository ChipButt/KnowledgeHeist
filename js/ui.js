import {
  SAVE_KEY,
  HISTORY_KEY,
  clearAllProgress,
  loadSave,
  readHistory
} from './storage.js';
import { getUnifiedLeaderboardRows } from './leaderboard.js';
import {
  getSettings,
  saveGameSettings,
  getVolumeScale,
  sanitizePlayerName
} from './settings.js';

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
      border: 1px solid rgba(60, 45, 28, 0.18);
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
    leaderboardTable: document.getElementById('leaderboardTable'),
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

function ensurePodiumContainer(refs) {
  let podium = document.getElementById('leaderboardPodium');
  if (podium) return podium;

  podium = document.createElement('div');
  podium.id = 'leaderboardPodium';

  const wrap = document.getElementById('leaderboardTableWrap');
  if (wrap && refs.leaderboardBoardScreen) {
    refs.leaderboardBoardScreen.insertBefore(podium, wrap);
  }

  return podium;
}

function renderPodium(rows, refs) {
  const podium = ensurePodiumContainer(refs);
  if (!podium) return;

  const topThree = rows.slice(0, 3);

  if (!topThree.length) {
    podium.innerHTML = '';
    return;
  }

  podium.innerHTML = topThree
    .map((row) => {
      return `
        <div class="leaderboard-podium-card">
          <div class="leaderboard-podium-rank">#${row.rank}</div>
          <div class="leaderboard-podium-name">${row.name}</div>
          <div class="leaderboard-podium-total">Total Bank: <strong>${formatMoney(row.totalBanked)}</strong></div>
          <div class="leaderboard-podium-best">Best Heist: <strong>${formatMoney(row.bestHeist)}</strong></div>
        </div>
      `;
    })
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
  refs.leaderboardViewSubtitle.textContent =
    'Ranked by Total Bank, with Best Heist shown alongside';
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
      .map((row) => {
        return `
          <tr>
            <td class="leaderboard-rank">${row.rank}</td>
            <td>${row.name}</td>
            <td class="leaderboard-value">${formatMoney(row.totalBanked)}</td>
            <td class="leaderboard-value">${formatMoney(row.bestHeist)}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Leaderboard load failed:', err);
    refs.leaderboardStatusText.textContent = 'Could not load leaderboard.';
    refs.leaderboardTableBody.innerHTML = `
      <tr>
        <td class="leaderboard-empty" colspan="4">Could not load leaderboard.</td>
      </tr>
    `;
    renderPodium([], refs);
  }
}

export function initUI(options = {}) {
  const { onStartHeist } = options;
  const refs = getHubRefs();
  const hubMusic = createHubMusic();

  let musicUnlocked = false;

  ensureUnifiedLeaderboardStyles();
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

  if (refs.instructionsBtn) {
    refs.instructionsBtn.addEventListener('click', () => show(refs.instructionsOverlay));
  }

  if (refs.closeInstructionsBtn) {
    refs.closeInstructionsBtn.addEventListener('click', () => hide(refs.instructionsOverlay));
  }

  if (refs.instructionsOverlay) {
    refs.instructionsOverlay.addEventListener('click', (e) => {
      if (e.target === refs.instructionsOverlay) hide(refs.instructionsOverlay);
    });
  }

  if (refs.settingsBtn) {
    refs.settingsBtn.addEventListener('click', () => {
      renderSettingsForm(refs);
      show(refs.settingsOverlay);
    });
  }

  if (refs.closeSettingsBtn) {
    refs.closeSettingsBtn.addEventListener('click', () => hide(refs.settingsOverlay));
  }

  if (refs.settingsOverlay) {
    refs.settingsOverlay.addEventListener('click', (e) => {
      if (e.target === refs.settingsOverlay) hide(refs.settingsOverlay);
    });
  }

  if (refs.hubVolumeInput) {
    refs.hubVolumeInput.addEventListener('input', () => {
      refs.hubVolumeValue.textContent = `${refs.hubVolumeInput.value}%`;
      hubMusic.volume = getVolumeScale(refs.hubVolumeInput.value);
    });
  }

  if (refs.gameMusicVolumeInput) {
    refs.gameMusicVolumeInput.addEventListener('input', () => {
      refs.gameMusicVolumeValue.textContent = `${refs.gameMusicVolumeInput.value}%`;
    });
  }

  if (refs.voiceVolumeInput) {
    refs.voiceVolumeInput.addEventListener('input', () => {
      refs.voiceVolumeValue.textContent = `${refs.voiceVolumeInput.value}%`;
    });
  }

  if (refs.saveSettingsBtn) {
    refs.saveSettingsBtn.addEventListener('click', () => {
      const cleanedName = sanitizePlayerName(refs.playerNameInput.value);

      saveGameSettings({
        playerName: cleanedName,
        hubVolume: refs.hubVolumeInput.value,
        gameMusicVolume: refs.gameMusicVolumeInput.value,
        voiceVolume: refs.voiceVolumeInput.value,
        difficulty: refs.difficultySelect.value
      });

      renderSettingsForm(refs);
      applyHubVolume();
      hide(refs.settingsOverlay);
    });
  }

  if (refs.resetBtn) {
    refs.resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      show(refs.resetConfirmOverlay);
    });
  }

  if (refs.cancelResetBtn) {
    refs.cancelResetBtn.addEventListener('click', () => hide(refs.resetConfirmOverlay));
  }

  if (refs.confirmResetBtn) {
    refs.confirmResetBtn.addEventListener('click', () => {
      pauseHubMusic();
      clearAllProgress();
      location.reload();
    });
  }

  if (refs.resetConfirmOverlay) {
    refs.resetConfirmOverlay.addEventListener('click', (e) => {
      if (e.target === refs.resetConfirmOverlay) hide(refs.resetConfirmOverlay);
    });
  }

  if (refs.leaderboardBtn) {
    refs.leaderboardBtn.addEventListener('click', () => {
      showUnifiedLeaderboard(refs);
    });
  }

  if (refs.closeLeaderboardBtn) {
    refs.closeLeaderboardBtn.addEventListener('click', () => {
      hide(refs.leaderboardOverlay);
    });
  }

  if (refs.closeLeaderboardFromBoardBtn) {
    refs.closeLeaderboardFromBoardBtn.addEventListener('click', () => {
      hide(refs.leaderboardOverlay);
    });
  }

  if (refs.leaderboardOverlay) {
    refs.leaderboardOverlay.addEventListener('click', (e) => {
      if (e.target === refs.leaderboardOverlay) hide(refs.leaderboardOverlay);
    });
  }

  if (typeof onStartHeist === 'function' && refs.startHeistBtn) {
    const handleStartHeist = () => {
      pauseHubMusic();
      onStartHeist();
    };

    refs.startHeistBtn.addEventListener('click', handleStartHeist);
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

  window.addEventListener('resize', () => {
    positionHubCells();
  });

  applyHubVolume();
  syncHubMusic();

  return {
    refreshHub: () => refreshHub(refs),
    pauseHubMusic,
    syncHubMusic
  };
}
