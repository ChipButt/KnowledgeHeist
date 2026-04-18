import {
  SAVE_KEY,
  HISTORY_KEY,
  loadSave,
  readHistory,
  writeHistory,
  formatDateShort,
  clearAllProgress
} from './storage.js';

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

function getHubRefs() {
  return {
    instructionsBtn: document.getElementById('instructionsBtn'),
    instructionsOverlay: document.getElementById('instructionsOverlay'),
    closeInstructionsBtn: document.getElementById('closeInstructionsBtn'),

    resetBtn: document.getElementById('resetProgressBtn'),
    resetConfirmOverlay: document.getElementById('resetConfirmOverlay'),
    confirmResetBtn: document.getElementById('confirmResetBtn'),
    cancelResetBtn: document.getElementById('cancelResetBtn'),

    leaderboardBtn: document.getElementById('leaderboardBtn'),
    leaderboardOverlay: document.getElementById('leaderboardOverlay'),
    closeLeaderboardBtn: document.getElementById('closeLeaderboardBtn'),

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

function backfillHistoryIfNeeded() {
  const save = loadSave();
  const history = readHistory();

  if (history.length === 0 && (save.heistsPlayed || 0) > 0) {
    const inferredSuccess = (save.totalBanked || 0) > 0 || (save.bestHeist || 0) > 0;

    writeHistory([
      {
        date: formatDateShort(),
        heistNumber: save.heistsPlayed || 1,
        success: inferredSuccess
      }
    ]);
  }
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
  backfillHistoryIfNeeded();
  renderHistory(refs);
  renderHubStats(refs);
}

export function initUI(options = {}) {
  const { onStartHeist } = options;
  const refs = getHubRefs();

  positionHubCells();
  refreshHub(refs);

  refs.instructionsBtn.addEventListener('click', () => show(refs.instructionsOverlay));
  refs.closeInstructionsBtn.addEventListener('click', () => hide(refs.instructionsOverlay));
  refs.instructionsOverlay.addEventListener('click', (e) => {
    if (e.target === refs.instructionsOverlay) hide(refs.instructionsOverlay);
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
    clearAllProgress();
    location.reload();
  });

  refs.resetConfirmOverlay.addEventListener('click', (e) => {
    if (e.target === refs.resetConfirmOverlay) hide(refs.resetConfirmOverlay);
  });

  refs.leaderboardBtn.addEventListener('click', () => show(refs.leaderboardOverlay));
  refs.closeLeaderboardBtn.addEventListener('click', () => hide(refs.leaderboardOverlay));
  refs.leaderboardOverlay.addEventListener('click', (e) => {
    if (e.target === refs.leaderboardOverlay) hide(refs.leaderboardOverlay);
  });

  if (typeof onStartHeist === 'function') {
    refs.startHeistBtn.addEventListener('click', onStartHeist);

    refs.startHeistBtn.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        refs.startHeistBtn.click();
      },
      { passive: false }
    );
  }

  window.addEventListener('nanaheist:data-updated', () => refreshHub(refs));

  window.addEventListener('storage', (e) => {
    if (e.key === SAVE_KEY || e.key === HISTORY_KEY) {
      refreshHub(refs);
    }
  });

  window.addEventListener('focus', () => refreshHub(refs));

  return {
    refreshHub: () => refreshHub(refs),
    showInstructions: () => show(refs.instructionsOverlay),
    hideInstructions: () => hide(refs.instructionsOverlay)
  };
}
