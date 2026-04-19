import { getQuestionBank } from './questions.js';
import {
  loadSave,
  saveProgress,
  loadLastHeistWrong,
  saveLastHeistWrong,
  appendHistoryEntry
} from './storage.js';
import { drawRoom } from './render.js';

export function initGame() {
  const hubScreen = document.getElementById('hubScreen');
  const gameScreen = document.getElementById('gameScreen');
  const backToHubBtn = document.getElementById('backToHubBtn');

  const haulValueEl = document.getElementById('haulValue');
  const strikesValueEl = document.getElementById('strikesValue');
  const paintingsLeftValueEl = document.getElementById('paintingsLeftValue');

  const questionModal = document.getElementById('questionModal');
  const questionTextEl = document.getElementById('questionText');
  const answerInput = document.getElementById('answerInput');
  const submitAnswerBtn = document.getElementById('submitAnswerBtn');
  const cancelAnswerBtn = document.getElementById('cancelAnswerBtn');

  const summaryOverlay = document.getElementById('summaryOverlay');
  const summaryTitle = document.getElementById('summaryTitle');
  const summarySubtitle = document.getElementById('summarySubtitle');
  const summaryContinueBtn = document.getElementById('summaryContinueBtn');

  const banner = document.getElementById('gameBanner');

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) throw new Error('Missing #gameCanvas');

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');

  const interactBtn = document.getElementById('interactBtn');
  const joystick = document.getElementById('joystick');
  const joystickButtons = Array.from(document.querySelectorAll('.joy-btn'));

  const SOURCE_W = 2816;
  const SOURCE_H = 1536;

  let VIEW_W = canvas.width;
  let VIEW_H = canvas.height;

  const DEBUG_INTERACTION = false;

  const sx = (x) => (x / SOURCE_W) * VIEW_W;
  const sy = (y) => (y / SOURCE_H) * VIEW_H;

  const constants = {
    MOVE_SPEED_DESKTOP: 2.35,
    MOVE_SPEED_MOBILE: 3.35,
    CHASE_PLAYER_SPEED: 2.6,
    GUARD_CHASE_SPEED: 3.35,
    GUARD_ESCORT_SPEED: 2.0,

    WALK_FRAME_MS: 120,
    RUN_FRAME_MS: 95,
    GUARD_WALK_FRAME_MS: 130,
    PULL_FRAME_MS: 120,

    WRONG_FLASH_MS: 260,
    SHAKE_MS: 260,
    GUARD_FLASH_MS: 2200,
    BANNER_MS: 2500,

    INTERACT_DISTANCE: 90,
    CATCH_DISTANCE: 28,
    POINTER_DEADZONE: 14
  };

  function isMobileLike() {
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.innerWidth < 900
    );
  }

  function getMoveSpeed() {
    return isMobileLike() ? constants.MOVE_SPEED_MOBILE : constants.MOVE_SPEED_DESKTOP;
  }

  function getCatchDistance() {
    return Math.max(18, sx(constants.CATCH_DISTANCE));
  }

  function getPlayerFeetOffsetY() {
    return Math.max(22, VIEW_H * 0.09);
  }

  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  function createAudio(src, volume = 1, loop = false) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.volume = volume;
    audio.loop = loop;
    return audio;
  }

  function formatMoney(pence) {
    return `£${(pence / 100).toFixed(2)}`;
  }

  function normalizeText(str) {
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9%.\-\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i += 1) dp[i][0] = i;
    for (let j = 0; j <= n; j += 1) dp[0][j] = j;

    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }

    return dp[m][n];
  }

  function closeEnough(a, b) {
    if (a.length < 5 || b.length < 5) return false;
    const d = levenshtein(a, b);
    return d <= 1 || d / Math.max(a.length, b.length) <= 0.15;
  }

  function isAnswerCorrect(input, question) {
    const cleanedInput = normalizeText(input);
    if (!cleanedInput) return false;

    const answers = Array.isArray(question.answers)
      ? question.answers.map(normalizeText)
      : [];

    if (question.matchType === 'contains') {
      for (const ans of answers) {
        if (cleanedInput.includes(ans)) return true;
        if (closeEnough(cleanedInput, ans)) return true;
      }
      return false;
    }

    for (const ans of answers) {
      if (cleanedInput === ans) return true;
      if (closeEnough(cleanedInput, ans)) return true;
    }

    return false;
  }

  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function pointInRect(px, py, rect) {
    return px >= rect.x1 && px <= rect.x2 && py >= rect.y1 && py <= rect.y2;
  }

  function pointInPolygon(point, polygon) {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect =
        (yi > point.y) !== (yj > point.y) &&
        point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.000001) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  function vectorToDirection(dx, dy) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX < 0.001 && absY < 0.001) return 'south';

    if (absX > absY * 1.8) {
      return dx > 0 ? 'east' : 'west';
    }

    if (absY > absX * 1.8) {
      return dy > 0 ? 'south' : 'north';
    }

    if (dx > 0 && dy < 0) return 'north-east';
    if (dx < 0 && dy < 0) return 'north-west';
    if (dx > 0 && dy > 0) return 'south-east';
    if (dx < 0 && dy > 0) return 'south-west';

    if (dx > 0) return 'east';
    if (dx < 0) return 'west';
    if (dy < 0) return 'north';
    return 'south';
  }

  function shuffle(arr) {
    const copy = [...arr];

    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }

  function normalizeVector(dx, dy, speed) {
    const len = Math.hypot(dx, dy);
    if (!len) return { dx: 0, dy: 0 };

    return {
      dx: (dx / len) * speed,
      dy: (dy / len) * speed
    };
  }

  function showBanner(text) {
    if (!banner) return;

    banner.textContent = text;
    banner.classList.add('show');

    clearTimeout(showBanner._timer);
    showBanner._timer = setTimeout(() => {
      banner.classList.remove('show');
      banner.textContent = '';
    }, constants.BANNER_MS);
  }

  function updateRunStats() {
    if (!state.run) return;

    if (haulValueEl) haulValueEl.textContent = formatMoney(state.run.haul);
    if (strikesValueEl) strikesValueEl.textContent = `${state.run.strikes} / 3`;

    if (paintingsLeftValueEl) {
      const left = state.run.items.filter((item) => item.status === 'available').length;
      paintingsLeftValueEl.textContent = String(left);
    }
  }

  function safeRestartAudio(audio, volume = 1) {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volume;
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {}
  }

  function stopAudio(audio) {
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (_) {}
  }

  function loadSeq(prefix, count) {
    return Array.from({ length: count }, (_, i) =>
      loadImage(`${prefix}${i}_delay-0.2s.png`)
    );
  }

  const backgroundMusicTracks = [
    'Minuet Antique.mp3',
    'track2.mp3',
    'track3.mp3',
    'track4.mp3',
    'track5.mp3',
    'track6.mp3',
    'track7.mp3',
    'track8.mp3',
    'track9.mp3',
    'track10.mp3'
  ];

  let lastBackgroundMusicTrack = '';

  function getNextBackgroundMusicTrack() {
    const availableTracks = backgroundMusicTracks.filter(
      (track) => track !== lastBackgroundMusicTrack
    );

    const nextTrack =
      availableTracks[Math.floor(Math.random() * availableTracks.length)];

    lastBackgroundMusicTrack = nextTrack;
    return nextTrack;
  }

  function createBackgroundMusic() {
    const audio = createAudio(getNextBackgroundMusicTrack(), 0.22, false);

    audio.addEventListener('ended', () => {
      audio.src = getNextBackgroundMusicTrack();
      audio.load();
      safeRestartAudio(audio, 0.22);
    });

    return audio;
  }

  const assets = {
    backgroundMusic: null,
    roomBackground: loadImage('museum-room.png'),

    chaChingSound: createAudio('ChaChing.mp3', 0.9, false),
    sirenSound: createAudio('Siren.mp3', 0.55, true),
    withMeSound: createAudio('WithMe.mp3', 0.95, false),
    heyStopSound: createAudio('Hey!Stop.mp3', 0.95, false),

    failVoiceFiles: [
      'Didntwantthat.mp3',
      'GottaGetThemRight.mp3',
      'IllGetTheNext.mp3',
      'NextTime.mp3'
    ],

    walkAnimations: {
      south: [
        loadImage('Nana South Walking_0_delay-0.2s.png'),
        loadImage('Nana South Walking_1_delay-0.2s.png'),
        loadImage('Nana South Walking_2_delay-0.2s.png'),
        loadImage('Nana South Walking_3_delay-0.2s.png'),
        loadImage('Nana South Walking_4_delay-0.2s.png'),
        loadImage('Nana South Walking_5_delay-0.2s.png')
      ],
      'south-east': [
        loadImage('Nana South-East Walking_0_delay-0.2s.png'),
        loadImage('Nana South-East Walking_1_delay-0.2s.png'),
        loadImage('Nana South-East Walking_2_delay-0.2s.png'),
        loadImage('Nana South-East Walking_3_delay-0.2s.png'),
        loadImage('Nana South-East Walking_4_delay-0.2s.png'),
        loadImage('Nana South-East Walking_5_delay-0.2s.png')
      ],
      east: [
        loadImage('Nana East Walking_0_delay-0.2s.png'),
        loadImage('Nana East Walking_1_delay-0.2s.png'),
        loadImage('Nana East Walking_2_delay-0.2s.png'),
        loadImage('Nana East Walking_3_delay-0.2s.png'),
        loadImage('Nana East Walking_4_delay-0.2s.png'),
        loadImage('Nana East Walking_5_delay-0.2s.png')
      ],
      'north-east': [
        loadImage('Nana North-East Walking_0_delay-0.2s.png'),
        loadImage('Nana North-East Walking_1_delay-0.2s.png'),
        loadImage('Nana North-East Walking_2_delay-0.2s.png'),
        loadImage('Nana North-East Walking_3_delay-0.2s.png'),
        loadImage('Nana North-East Walking_4_delay-0.2s.png'),
        loadImage('Nana North-East Walking_5_delay-0.2s.png')
      ],
      north: [
        loadImage('Nana North Walking_0_delay-0.2s.png'),
        loadImage('Nana North Walking_1_delay-0.2s.png'),
        loadImage('Nana North Walking_2_delay-0.2s.png'),
        loadImage('Nana North Walking_3_delay-0.2s.png'),
        loadImage('Nana North Walking_4_delay-0.2s.png'),
        loadImage('Nana North Walking_5_delay-0.2s.png')
      ],
      'north-west': [
        loadImage('Nana North-West Walking_0_delay-0.2s.png'),
        loadImage('Nana North-West Walking_1_delay-0.2s.png'),
        loadImage('Nana North-West Walking_2_delay-0.2s.png'),
        loadImage('Nana North-West Walking_3_delay-0.2s.png'),
        loadImage('Nana North-West Walking_4_delay-0.2s.png'),
        loadImage('Nana North-West Walking_5_delay-0.2s.png')
      ],
      west: [
        loadImage('Nana West Walking_0_delay-0.2s.png'),
        loadImage('Nana West Walking_1_delay-0.2s.png'),
        loadImage('Nana West Walking_2_delay-0.2s.png'),
        loadImage('Nana West Walking_3_delay-0.2s.png'),
        loadImage('Nana West Walking_4_delay-0.2s.png'),
        loadImage('Nana West Walking_5_delay-0.2s.png')
      ],
      'south-west': [
        loadImage('Nana South-West Walking_0_delay-0.2s.png'),
        loadImage('Nana South-West Walking_1_delay-0.2s.png'),
        loadImage('Nana South-West Walking_2_delay-0.2s.png'),
        loadImage('Nana South-West Walking_3_delay-0.2s.png'),
        loadImage('Nana South-West Walking_4_delay-0.2s.png'),
        loadImage('Nana South-West Walking_5_delay-0.2s.png')
      ]
    },

    pullAnimations: {
      east: [
        loadImage('Nana East Pull_0_delay-0.2s.png'),
        loadImage('Nana East Pull_1_delay-0.2s.png'),
        loadImage('Nana East Pull_2_delay-0.2s.png'),
        loadImage('Nana East Pull_3_delay-0.2s.png'),
        loadImage('Nana East Pull_4_delay-0.2s.png'),
        loadImage('Nana East Pull_5_delay-0.2s.png')
      ],
      north: [
        loadImage('Nana North Pull_0_delay-0.2s.png'),
        loadImage('Nana North Pull_1_delay-0.2s.png'),
        loadImage('Nana North Pull_2_delay-0.2s.png'),
        loadImage('Nana North Pull_3_delay-0.2s.png'),
        loadImage('Nana North Pull_4_delay-0.2s.png'),
        loadImage('Nana North Pull_5_delay-0.2s.png')
      ],
      west: [
        loadImage('Nana West Pull_0_delay-0.2s.png'),
        loadImage('Nana West Pull_1_delay-0.2s.png'),
        loadImage('Nana West Pull_2_delay-0.2s.png'),
        loadImage('Nana West Pull_3_delay-0.2s.png'),
        loadImage('Nana West Pull_4_delay-0.2s.png'),
        loadImage('Nana West Pull_5_delay-0.2s.png')
      ]
    },

    guardRunAnimations: {
      east: loadSeq('Security Guard East Running_', 6),
      west: loadSeq('Security Guard West Running_', 6),
      north: loadSeq('Security Guard North Running_', 6),
      south: loadSeq('Security Guard South Running_', 6),
      'north-east': loadSeq('Security Guard North-East Running_', 6),
      'north-west': loadSeq('Security Guard North-West Running_', 6),
      'south-east': loadSeq('Security Guard South-East Running_', 6),
      'south-west': loadSeq('Security Guard South-West Running_', 6)
    },

    guardWalkAnimations: {
      south: loadSeq('Security Guard South Walking_', 6),
      'south-east': loadSeq('Security Guard South-East Walking_', 6),
      'south-west': loadSeq('Security Guard South-West Walking_', 6)
    },

    artImages: {
      northA: loadImage('painting_abstract_small.png'),
      northB: loadImage('painting_mona_lisa_large.png'),
      northC: loadImage('painting_starry_night.png'),
      westA: loadImage('painting_landscape_left_angle.png'),
      westB: loadImage('painting_portrait_left_lower_angle.png'),
      westC: loadImage('painting_portrait_left_lower_angle_2.png'),
      westD: loadImage('painting_portrait_left_lower_angle_3.png'),
      eastA: loadImage('painting_portrait_right_angle.png'),
      eastB: loadImage('painting_mona_lisa_right_lower_angle.png'),
      aboard: loadImage('A-Board_Art_Piece.png'),
      pedestal: loadImage('statue_on_pedestal.png')
    }
  };

  assets.backgroundMusic = createBackgroundMusic();

  const state = {
    save: loadSave(),
    homework: {
      pending: loadLastHeistWrong()
    },
    screen: 'hub',
    keys: { up: false, down: false, left: false, right: false },
    run: null,
    activeItem: null,
    lastTimestamp: 0,
    player: {
      x: 0,
      y: 0,
      direction: 'south',
      moving: false,
      visible: true,
      controlLocked: false,
      walkFrameIndex: 0,
      walkFrameTimer: 0,
      action: null
    },
    guard: {
      x: 0,
      y: 0,
      direction: 'south-west',
      active: false,
      visible: true,
      mode: 'run',
      frameIndex: 0,
      frameTimer: 0,
      moving: false
    },
    fx: {
      wrongFlashTimer: 0,
      guardFlashTimer: 0,
      shakeTimer: 0,
      shakeX: 0,
      shakeY: 0
    },
    audio: {
      sirenStarted: false,
      withMePlayed: false,
      withMeFinished: true
    },
    pointer: {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      dragX: 0,
      dragY: 0
    },
    confirm: {
      open: false,
      onConfirm: null,
      onCancel: null
    }
  };

  function ensureHomeworkPopup() {
    if (document.getElementById('homeworkOverlay')) return;

    const style = document.createElement('style');
    style.textContent = `
      #homeworkOverlay {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.48);
        z-index: 9999;
        padding: 18px;
      }
      #homeworkOverlay.show {
        display: flex;
      }
      #homeworkBoard {
        width: min(760px, 94vw);
        max-height: 82vh;
        overflow: auto;
        background: linear-gradient(180deg, #1f3b2b 0%, #14261c 100%);
        border: 12px solid #6f5437;
        border-radius: 18px;
        box-shadow: 0 20px 55px rgba(0,0,0,0.45);
        color: #f2f5ef;
        padding: 22px 22px 18px;
        font-family: "Trebuchet MS", Arial, sans-serif;
      }
      #homeworkBoard h2 {
        margin: 0 0 6px;
        color: #f5f7f1;
        font-size: 30px;
        line-height: 1.1;
        text-align: center;
      }
      #homeworkBoard .chalk-sub {
        text-align: center;
        margin-bottom: 18px;
        font-size: 17px;
        color: #d9e8dd;
      }
      #homeworkList {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .homework-item {
        border-top: 1px dashed rgba(240,255,240,0.26);
        padding-top: 12px;
      }
      .homework-question {
        font-size: 17px;
        line-height: 1.35;
        color: #ffffff;
        margin-bottom: 6px;
      }
      .homework-answer {
        font-size: 16px;
        line-height: 1.3;
        color: #d6f2d2;
      }
      .homework-close {
        display: block;
        margin: 18px auto 0;
        border: none;
        border-radius: 999px;
        background: #ece7d8;
        color: #1b1b1b;
        padding: 10px 18px;
        font-weight: 700;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'homeworkOverlay';
    overlay.innerHTML = `
      <div id="homeworkBoard" role="dialog" aria-modal="true" aria-labelledby="homeworkTitle">
        <h2 id="homeworkTitle">Preparation for Next Heist</h2>
        <div class="chalk-sub">Best do your homework.</div>
        <div id="homeworkList"></div>
        <button class="homework-close" id="homeworkCloseBtn">Got it</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideHomeworkPopup();
    });

    const closeBtn = document.getElementById('homeworkCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', hideHomeworkPopup);
  }

  function ensureConfirmPopup() {
    if (document.getElementById('confirmChoiceOverlay')) return;

    const style = document.createElement('style');
    style.textContent = `
      #confirmChoiceOverlay {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.58);
        z-index: 9600;
        padding: 18px;
      }
      #confirmChoiceOverlay.show {
        display: flex;
      }
      #confirmChoiceCard {
        width: min(560px, 94vw);
        background: #f0e6d0;
        color: #241c14;
        border-radius: 16px;
        border: 8px solid #77593c;
        padding: 20px;
        box-shadow: 0 16px 50px rgba(0,0,0,0.42);
        text-align: center;
      }
      #confirmChoiceTitle {
        margin: 0 0 12px;
        font-size: 24px;
      }
      #confirmChoiceText {
        line-height: 1.5;
        margin-bottom: 16px;
      }
      #confirmChoiceActions {
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      #confirmChoiceActions button {
        border: none;
        border-radius: 999px;
        padding: 10px 18px;
        font-weight: 700;
        cursor: pointer;
        background: #283545;
        color: #f3ede2;
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'confirmChoiceOverlay';
    overlay.innerHTML = `
      <div id="confirmChoiceCard" role="dialog" aria-modal="true" aria-labelledby="confirmChoiceTitle">
        <h2 id="confirmChoiceTitle">Are you sure?</h2>
        <div id="confirmChoiceText"></div>
        <div id="confirmChoiceActions">
          <button id="confirmChoiceYesBtn" type="button">Yes</button>
          <button id="confirmChoiceNoBtn" type="button">No</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeAsCancel = () => {
      const cancelFn = state.confirm.onCancel;
      closeConfirmPopup();
      if (typeof cancelFn === 'function') cancelFn();
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAsCancel();
    });

    document.getElementById('confirmChoiceYesBtn')?.addEventListener('click', () => {
      const confirmFn = state.confirm.onConfirm;
      closeConfirmPopup();
      if (typeof confirmFn === 'function') confirmFn();
    });

    document.getElementById('confirmChoiceNoBtn')?.addEventListener('click', closeAsCancel);
  }

  function openConfirmPopup({ title, text, onConfirm, onCancel }) {
    ensureConfirmPopup();

    const overlay = document.getElementById('confirmChoiceOverlay');
    const titleEl = document.getElementById('confirmChoiceTitle');
    const textEl = document.getElementById('confirmChoiceText');

    state.confirm.open = true;
    state.confirm.onConfirm = onConfirm || null;
    state.confirm.onCancel = onCancel || null;

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (overlay) overlay.classList.add('show');
  }

  function closeConfirmPopup() {
    const overlay = document.getElementById('confirmChoiceOverlay');
    if (overlay) overlay.classList.remove('show');

    state.confirm.open = false;
    state.confirm.onConfirm = null;
    state.confirm.onCancel = null;
  }

  function isConfirmPopupOpen() {
    return state.confirm.open;
  }

  function stopAllGameAudio() {
    stopAudio(assets.backgroundMusic);
    stopAudio(assets.sirenSound);
    stopAudio(assets.withMeSound);
    stopAudio(assets.heyStopSound);
    stopAudio(assets.chaChingSound);
  }

  function playRandomFailVoice() {
    if (!state.run) return;

    if (!state.run.failVoicePool || state.run.failVoicePool.length === 0) {
      state.run.failVoicePool = shuffle([...assets.failVoiceFiles]);
    }

    const file = state.run.failVoicePool.shift();
    const audio = createAudio(file, 0.9, false);
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  function playHeyStopThenSiren() {
    state.audio.sirenStarted = false;

    const startSiren = () => {
      if (state.audio.sirenStarted) return;
      state.audio.sirenStarted = true;
      safeRestartAudio(assets.sirenSound, 0.55);
    };

    try {
      assets.heyStopSound.pause();
      assets.heyStopSound.currentTime = 0;
      assets.heyStopSound.volume = 0.95;
      assets.heyStopSound.addEventListener('ended', startSiren, { once: true });

      const p = assets.heyStopSound.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => startSiren());
      }
    } catch (_) {
      startSiren();
    }

    setTimeout(() => {
      if (
        state.run &&
        (
          state.run.mode === 'chase' ||
          state.run.mode === 'escort' ||
          state.run.mode === 'escort_wait'
        )
      ) {
        startSiren();
      }
    }, 1200);
  }

  function playWithMe() {
    state.audio.withMeFinished = false;
    state.audio.withMePlayed = true;

    try {
      assets.withMeSound.pause();
      assets.withMeSound.currentTime = 0;
      assets.withMeSound.onended = () => {
        state.audio.withMeFinished = true;
      };

      const p = assets.withMeSound.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          state.audio.withMeFinished = true;
        });
      }
    } catch (_) {
      state.audio.withMeFinished = true;
    }
  }

  function getFloorPoly() {
    return [
      { x: sx(738), y: sy(730) },
      { x: sx(2073), y: sy(730) },
      { x: sx(2505), y: sy(1360) },
      { x: sx(281), y: sy(1360) }
    ];
  }

  function getExitZone() {
    return {
      x1: sx(1180),
      y1: sy(1280),
      x2: sx(1640),
      y2: sy(1495)
    };
  }

  function getGuardDoorZone() {
    return {
      x1: sx(2522),
      y1: sy(1174),
      x2: sx(2639),
      y2: sy(1325)
    };
  }

  function getFloorItemBlocker(item) {
    if (!item || item.type !== 'floor' || item.status === 'stolen') return null;

    return {
      x1: item.anchorX - item.drawW * 0.46,
      y1: item.anchorY - item.drawH * 0.18,
      x2: item.anchorX + item.drawW * 0.46,
      y2: item.anchorY + 10
    };
  }

  function pointHitsFloorBlocker(px, py) {
    if (!state.run) return false;

    for (const item of state.run.items) {
      const blocker = getFloorItemBlocker(item);
      if (blocker && pointInRect(px, py, blocker)) return true;
    }

    return false;
  }

  function isWalkablePoint(x, y, options = {}) {
    if (!pointInPolygon({ x, y }, getFloorPoly())) return false;
    if (!options.ignoreFloorBlockers && pointHitsFloorBlocker(x, y)) return false;
    return true;
  }

  function randomFloorPoint(minX, maxX, minY, maxY, avoid = []) {
    for (let i = 0; i < 500; i += 1) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      if (!isWalkablePoint(x, y, { ignoreFloorBlockers: false })) continue;
      if (pointInRect(x, y, getExitZone())) continue;
      if (distance(x, y, sx(1410), sy(1220)) < 90) continue;

      let tooClose = false;
      for (const other of avoid) {
        if (distance(x, y, other.x, other.y) < 150) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) return { x, y };
    }

    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  function createHeistItems() {
    const items = [];

    const cx = (x) => (x / 1024) * VIEW_W;
    const cy = (y) => (y / 670) * VIEW_H;

    const northSlots = [
      {
        x: sx(898 - 175),
        y: sy(443 - 75),
        w: sx(350),
        h: sy(150),
        anchorX: cx(305),
        anchorY: cy(289),
        wall: 'north',
        image: assets.artImages.northA
      },
      {
        x: sx(1414 - 175),
        y: sy(393 - 75),
        w: sx(350),
        h: sy(150),
        anchorX: cx(479),
        anchorY: cy(286),
        wall: 'north',
        image: assets.artImages.northB
      },
      {
        x: sx(1925 - 175),
        y: sy(440 - 75),
        w: sx(350),
        h: sy(150),
        anchorX: cx(655),
        anchorY: cy(286),
        wall: 'north',
        image: assets.artImages.northC
      }
    ];

    const westSlots = [
      {
        x: sx(503 - 80),
        y: sy(576 - 160),
        w: sx(160),
        h: sy(320),
        anchorX: cx(223),
        anchorY: cy(342),
        wall: 'west',
        image: assets.artImages.westA
      },
      {
        x: sx(291 - 80),
        y: sy(806 - 160),
        w: sx(160),
        h: sy(320),
        anchorX: cx(149),
        anchorY: cy(464),
        wall: 'west',
        image: shuffle([
          assets.artImages.westB,
          assets.artImages.westC,
          assets.artImages.westD
        ])[0]
      }
    ];

    const eastSlots = [
      {
        x: sx(2219 - 80),
        y: sy(525 - 160),
        w: sx(160),
        h: sy(320),
        anchorX: cx(732),
        anchorY: cy(324),
        wall: 'east',
        image: assets.artImages.eastA
      },
      {
        x: sx(2405 - 80),
        y: sy(721 - 160),
        w: sx(160),
        h: sy(320),
        anchorX: cx(779),
        anchorY: cy(401),
        wall: 'east',
        image: assets.artImages.eastB
      }
    ];

    let index = 0;

    northSlots.forEach((slot) => {
      items.push({
        id: `item-${index}`,
        type: 'wall',
        status: 'available',
        question: null,
        ...slot
      });
      index += 1;
    });

    westSlots.forEach((slot) => {
      items.push({
        id: `item-${index}`,
        type: 'wall',
        status: 'available',
        question: null,
        ...slot
      });
      index += 1;
    });

    eastSlots.forEach((slot) => {
      items.push({
        id: `item-${index}`,
        type: 'wall',
        status: 'available',
        question: null,
        ...slot
      });
      index += 1;
    });

    const pedestalPos = randomFloorPoint(
      sx(1050),
      sx(1700),
      sy(930),
      sy(1190),
      []
    );

    items.push({
      id: `item-${index}`,
      type: 'floor',
      floorKind: 'pedestal',
      status: 'available',
      question: null,
      image: assets.artImages.pedestal,
      anchorX: pedestalPos.x,
      anchorY: pedestalPos.y - cy(10),
      drawW: 80,
      drawH: 118
    });
    index += 1;

    const aboardPos = randomFloorPoint(
      sx(1820),
      sx(2230),
      sy(930),
      sy(1220),
      [{ x: pedestalPos.x, y: pedestalPos.y - cy(10) }]
    );

    items.push({
      id: `item-${index}`,
      type: 'floor',
      floorKind: 'aboard',
      status: 'available',
      question: null,
      image: assets.artImages.aboard,
      anchorX: aboardPos.x,
      anchorY: aboardPos.y - cy(10),
      drawW: 84,
      drawH: 122
    });

    return items;
  }

  function buildScaledRunData(run) {
    for (const item of run.items) {
      if (item.type === 'floor') {
        if (item.floorKind === 'pedestal') {
          item.drawW = Math.max(74, sx(96));
          item.drawH = Math.max(108, sy(150));
        } else {
          item.drawW = Math.max(78, sx(104));
          item.drawH = Math.max(112, sy(158));
        }
      }
    }
  }

  function scaleValue(value, fromSize, toSize) {
    if (!fromSize) return value;
    return value * (toSize / fromSize);
  }

  function rescaleActiveRun(prevW, prevH, nextW, nextH) {
    if (!state.run || !prevW || !prevH) return;

    for (const item of state.run.items) {
      if (typeof item.x === 'number') item.x = scaleValue(item.x, prevW, nextW);
      if (typeof item.y === 'number') item.y = scaleValue(item.y, prevH, nextH);
      if (typeof item.w === 'number') item.w = scaleValue(item.w, prevW, nextW);
      if (typeof item.h === 'number') item.h = scaleValue(item.h, prevH, nextH);
      if (typeof item.anchorX === 'number') item.anchorX = scaleValue(item.anchorX, prevW, nextW);
      if (typeof item.anchorY === 'number') item.anchorY = scaleValue(item.anchorY, prevH, nextH);
      if (typeof item.drawW === 'number') item.drawW = scaleValue(item.drawW, prevW, nextW);
      if (typeof item.drawH === 'number') item.drawH = scaleValue(item.drawH, prevH, nextH);
    }

    state.player.x = scaleValue(state.player.x, prevW, nextW);
    state.player.y = scaleValue(state.player.y, prevH, nextH);
    state.guard.x = scaleValue(state.guard.x, prevW, nextW);
    state.guard.y = scaleValue(state.guard.y, prevH, nextH);
  }

  function resizeCanvas() {
    const prevW = canvas.width || VIEW_W || 1;
    const prevH = canvas.height || VIEW_H || 1;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    canvas.width = width;
    canvas.height = height;

    VIEW_W = width;
    VIEW_H = height;

    if (state.run && (prevW !== width || prevH !== height)) {
      rescaleActiveRun(prevW, prevH, width, height);
    } else if (state.run) {
      buildScaledRunData(state.run);
    }
  }

  function markQuestionUsed(questionId) {
    if (!questionId) return;

    if (!state.save.usedQuestionIds.includes(questionId)) {
      state.save.usedQuestionIds.push(questionId);
      saveProgress(state.save);
    }
  }

  function getUnusedQuestions() {
    const bank = getQuestionBank();
    const used = new Set(state.save.usedQuestionIds);
    return bank.filter((q) => !used.has(q.id));
  }

  function chooseQuestionForItem(item) {
    if (item.question) return item.question;

    const available = getUnusedQuestions();
    if (available.length === 0) return null;

    const q = shuffle(available)[0];
    item.question = q;
    return q;
  }

  function recordWrongQuestion(questionObj) {
    if (!questionObj || !state.run) return;

    const firstAnswer =
      Array.isArray(questionObj.answers) && questionObj.answers.length
        ? questionObj.answers[0]
        : '';

    state.run.wrongQuestions.push({
      question: questionObj.question,
      answer: firstAnswer
    });
  }

  function getPlayerInteractPoint() {
    return {
      x: state.player.x,
      y: state.player.y - getPlayerFeetOffsetY()
    };
  }

  function getItemInteractPoint(item) {
    if (item.type === 'floor') {
      return {
        x: item.anchorX,
        y: item.anchorY - Math.max(6, item.drawH * 0.08)
      };
    }

    if (item.wall === 'north') {
      return {
        x: item.x + item.w * 0.5,
        y: item.y + item.h + sy(72)
      };
    }

    if (item.wall === 'west') {
      return {
        x: item.x + item.w * 0.42,
        y: item.y + item.h + sy(82)
      };
    }

    if (item.wall === 'east') {
      return {
        x: item.x + item.w * 0.58,
        y: item.y + item.h + sy(82)
      };
    }

    return {
      x: item.anchorX,
      y: item.anchorY
    };
  }

  function getItemInteractRadius(item) {
    if (item.type === 'floor') return Math.max(34, sx(44));
    if (item.wall === 'north') return Math.max(34, sx(50));
    return Math.max(30, sx(42));
  }

  function getNearbyItem() {
    if (!state.run || state.run.mode !== 'play') return null;

    const playerPoint = getPlayerInteractPoint();
    let nearest = null;
    let nearestDist = Infinity;

    for (const item of state.run.items) {
      if (item.status !== 'available') continue;

      const itemPoint = getItemInteractPoint(item);
      const allowedDist = getItemInteractRadius(item);
      const d = distance(playerPoint.x, playerPoint.y, itemPoint.x, itemPoint.y);

      if (d <= allowedDist && d < nearestDist) {
        nearest = item;
        nearestDist = d;
      }
    }

    return nearest;
  }

  function getPullDirectionForItem(item) {
    if (item.type === 'wall') return item.wall;

    const dx = item.anchorX - state.player.x;
    if (dx > 22) return 'east';
    if (dx < -22) return 'west';
    return 'north';
  }

  function updateWalkAnimation(delta) {
    if (!state.player.moving) {
      state.player.walkFrameIndex = 0;
      state.player.walkFrameTimer = 0;
      return;
    }

    state.player.walkFrameTimer += delta;
    if (state.player.walkFrameTimer >= constants.WALK_FRAME_MS) {
      state.player.walkFrameTimer = 0;
      state.player.walkFrameIndex = (state.player.walkFrameIndex + 1) % 6;
    }
  }

  function updateGuardAnimation(delta) {
    if (!state.guard.active) return;

    const frameMs =
      state.guard.mode === 'walk'
        ? constants.GUARD_WALK_FRAME_MS
        : constants.RUN_FRAME_MS;

    if (!state.guard.moving) {
      state.guard.frameIndex = 0;
      state.guard.frameTimer = 0;
      return;
    }

    state.guard.frameTimer += delta;
    if (state.guard.frameTimer >= frameMs) {
      state.guard.frameTimer = 0;
      state.guard.frameIndex = (state.guard.frameIndex + 1) % 6;
    }
  }

  function startPullAnimation(item) {
    const pullDir = getPullDirectionForItem(item);

    state.player.controlLocked = true;
    state.run.mode = 'pull';
    state.player.action = {
      type: 'pull',
      dir: pullDir,
      item,
      frameIndex: 0,
      timer: 0
    };

    if (pullDir === 'north') state.player.direction = 'north';
    if (pullDir === 'west') state.player.direction = 'north-west';
    if (pullDir === 'east') state.player.direction = 'north-east';
  }

  function finishSuccessfulPull() {
    const action = state.player.action;
    if (!action || action.type !== 'pull') return;

    const item = action.item;
    const q = item.question;

    item.status = 'stolen';
    state.run.haul += Number(q.value || 0);

    updateRunStats();
    showBanner(`Stolen! +${formatMoney(Number(q.value || 0))}`);
    safeRestartAudio(assets.chaChingSound, 0.9);

    state.player.action = null;
    state.player.controlLocked = false;
    state.run.mode = 'play';

    if (state.run.items.every((itemEntry) => itemEntry.status !== 'available')) {
      showBanner('All items attempted. Head for the exit.');
    }
  }

  function updatePullAnimation(delta) {
    const action = state.player.action;
    if (!action || action.type !== 'pull') return;

    action.timer += delta;

    if (action.timer >= constants.PULL_FRAME_MS) {
      action.timer = 0;
      action.frameIndex += 1;

      if (action.frameIndex >= 6) {
        finishSuccessfulPull();
      }
    }
  }

  function tryMove(dx, dy, options = {}) {
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;

    if (!pointInPolygon({ x: nx, y: ny }, getFloorPoly())) return;
    if (!options.ignoreBlockers && pointHitsFloorBlocker(nx, ny)) return;

    state.player.x = nx;
    state.player.y = ny;
  }

  function moveTowards(entity, targetX, targetY, speed, dirResolver = vectorToDirection) {
    const dx = targetX - entity.x;
    const dy = targetY - entity.y;
    const len = Math.hypot(dx, dy);

    if (len < 0.001) {
      entity.moving = false;
      return;
    }

    const mx = (dx / len) * speed;
    const my = (dy / len) * speed;

    entity.x += mx;
    entity.y += my;
    entity.direction = dirResolver(mx, my);
    entity.moving = true;
  }

  function escortDirectionResolver(dx, dy) {
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return 'south';
    if (dy >= 0) {
      if (dx > 0.45) return 'south-east';
      if (dx < -0.45) return 'south-west';
      return 'south';
    }
    if (dx > 0.3) return 'south-east';
    if (dx < -0.3) return 'south-west';
    return 'south';
  }

  function flashWrong() {
    state.fx.wrongFlashTimer = constants.WRONG_FLASH_MS;
    state.fx.shakeTimer = constants.SHAKE_MS;
  }

  function updateFX(delta) {
    if (state.fx.wrongFlashTimer > 0) {
      state.fx.wrongFlashTimer = Math.max(0, state.fx.wrongFlashTimer - delta);
    }

    if (state.fx.guardFlashTimer > 0) {
      state.fx.guardFlashTimer = Math.max(0, state.fx.guardFlashTimer - delta);
    }

    if (state.fx.shakeTimer > 0) {
      state.fx.shakeTimer = Math.max(0, state.fx.shakeTimer - delta);
      state.fx.shakeX = (Math.random() - 0.5) * 10;
      state.fx.shakeY = (Math.random() - 0.5) * 8;
    } else {
      state.fx.shakeX = 0;
      state.fx.shakeY = 0;
    }
  }

  function triggerGuardChase() {
    state.guard.active = true;
    state.guard.visible = true;
    state.guard.mode = 'run';
    state.guard.frameIndex = 0;
    state.guard.frameTimer = 0;
    state.guard.moving = true;

    state.player.controlLocked = false;
    state.run.mode = 'chase';
    state.fx.guardFlashTimer = constants.GUARD_FLASH_MS;
    state.audio.withMePlayed = false;
    state.audio.withMeFinished = false;

    playHeyStopThenSiren();
    showBanner('Security is coming...');
  }

  function triggerHeistEndHomework() {
    state.homework.pending = state.run?.wrongQuestions ? [...state.run.wrongQuestions] : [];
    saveLastHeistWrong(state.homework.pending);
  }

  function maybeShowHomeworkPopup() {
    ensureHomeworkPopup();

    if (!state.homework.pending.length || state.screen !== 'hub') return;

    const overlay = document.getElementById('homeworkOverlay');
    const list = document.getElementById('homeworkList');
    if (!overlay || !list) return;

    list.innerHTML = '';

    state.homework.pending.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'homework-item';
      item.innerHTML = `
        <div class="homework-question">${entry.question}</div>
        <div class="homework-answer">Answer: ${entry.answer}</div>
      `;
      list.appendChild(item);
    });

    overlay.classList.add('show');
  }

  function hideHomeworkPopup() {
    ensureHomeworkPopup();
    const overlay = document.getElementById('homeworkOverlay');
    if (overlay) overlay.classList.remove('show');
  }

  function closeQuestionModal() {
    questionModal.classList.add('hidden');
    state.activeItem = null;
    answerInput.blur();
  }

  function resetMovementKeys() {
    state.keys.up = false;
    state.keys.down = false;
    state.keys.left = false;
    state.keys.right = false;
  }

  function resetPointerInput() {
    state.pointer.active = false;
    state.pointer.pointerId = null;
    state.pointer.startX = 0;
    state.pointer.startY = 0;
    state.pointer.currentX = 0;
    state.pointer.currentY = 0;
    state.pointer.dragX = 0;
    state.pointer.dragY = 0;
  }

  function hasKeyboardInput() {
    return state.keys.up || state.keys.down || state.keys.left || state.keys.right;
  }

  function getCanvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * VIEW_W,
      y: ((e.clientY - rect.top) / rect.height) * VIEW_H
    };
  }

  function startPointerControl(e) {
    if (state.screen !== 'game') return;
    if (!state.run || state.run.ended) return;
    if (!questionModal.classList.contains('hidden')) return;
    if (isConfirmPopupOpen()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const point = getCanvasPointFromEvent(e);

    state.pointer.active = true;
    state.pointer.pointerId = e.pointerId;
    state.pointer.startX = point.x;
    state.pointer.startY = point.y;
    state.pointer.currentX = point.x;
    state.pointer.currentY = point.y;
    state.pointer.dragX = 0;
    state.pointer.dragY = 0;

    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
  }

  function updatePointerControl(e) {
    if (!state.pointer.active) return;
    if (state.pointer.pointerId !== e.pointerId) return;

    const point = getCanvasPointFromEvent(e);
    state.pointer.currentX = point.x;
    state.pointer.currentY = point.y;

    const rawDx = state.pointer.currentX - state.pointer.startX;
    const rawDy = state.pointer.currentY - state.pointer.startY;
    const len = Math.hypot(rawDx, rawDy);

    if (len < sx(constants.POINTER_DEADZONE)) {
      state.pointer.dragX = 0;
      state.pointer.dragY = 0;
      return;
    }

    state.pointer.dragX = rawDx / len;
    state.pointer.dragY = rawDy / len;
  }

  function endPointerControl(e) {
    if (!state.pointer.active) return;
    if (e && state.pointer.pointerId !== null && e.pointerId !== state.pointer.pointerId) return;
    resetPointerInput();
  }

  async function requestGameFullscreen() {
    if (!isMobileLike()) return;
    if (document.fullscreenElement) return;

    const target = gameScreen || document.documentElement;
    if (!target) return;

    try {
      if (typeof target.requestFullscreen === 'function') {
        await target.requestFullscreen();
      }
    } catch (_) {}
  }

  function endHeist(escaped) {
    if (!state.run || state.run.ended) return;

    state.run.ended = true;
    stopAllGameAudio();
    triggerHeistEndHomework();

    if (escaped) {
      state.save.heistsPlayed += 1;
      state.save.totalBanked += state.run.haul;

      if (state.run.haul > state.save.bestHeist) {
        state.save.bestHeist = state.run.haul;
      }

      state.save.paintingsStolen += state.run.items.filter((item) => item.status === 'stolen').length;

      saveProgress(state.save);
      appendHistoryEntry({
        heistNumber: state.save.heistsPlayed,
        success: true
      });

      summaryTitle.textContent = 'Heist complete';
      summarySubtitle.textContent = `You escaped with ${formatMoney(state.run.haul)}. It has been added to your total banked cash.`;
      summaryOverlay.classList.remove('hidden');
      return;
    }

    state.save.heistsPlayed += 1;
    saveProgress(state.save);
    appendHistoryEntry({
      heistNumber: state.save.heistsPlayed,
      success: false
    });

    returnCaughtToHub();
  }

  function returnCaughtToHub() {
    if (!state.run) return;

    closeQuestionModal();
    closeConfirmPopup();
    resetMovementKeys();
    resetPointerInput();

    state.run.ended = true;
    state.run = null;
    state.activeItem = null;

    state.player.action = null;
    state.player.controlLocked = false;
    state.player.moving = false;
    state.player.visible = true;

    state.guard.active = false;
    state.guard.visible = true;

    summaryOverlay.classList.add('hidden');
    showScreen('hub');
    maybeShowHomeworkPopup();
    showBanner('Caught! Better luck next heist.');
  }

  function returnToHub() {
    stopAllGameAudio();
    closeQuestionModal();
    closeConfirmPopup();
    resetMovementKeys();
    resetPointerInput();

    summaryOverlay.classList.add('hidden');
    state.run = null;
    state.activeItem = null;
    state.player.action = null;
    showScreen('hub');
    maybeShowHomeworkPopup();
  }

  function handleReturnToBase() {
    if (!state.run || state.run.ended) {
      showScreen('hub');
      return;
    }

    openConfirmPopup({
      title: 'Return to Base?',
      text: `Are you sure you want to return home? You'll lose your current haul of ${formatMoney(state.run.haul)}.`,
      onConfirm: () => {
        stopAllGameAudio();
        closeQuestionModal();
        resetMovementKeys();
        resetPointerInput();

        state.run = null;
        state.activeItem = null;
        state.player.action = null;
        showScreen('hub');
        maybeShowHomeworkPopup();
      }
    });
  }

  function showScreen(name) {
    state.screen = name;

    if (hubScreen) hubScreen.classList.toggle('active', name === 'hub');
    if (gameScreen) gameScreen.classList.toggle('active', name === 'game');

    if (name === 'game') {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      document.body.style.touchAction = 'none';
      canvas.style.touchAction = 'none';
      window.scrollTo(0, 0);
      resizeCanvas();
    } else {
      stopAllGameAudio();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.body.style.touchAction = '';
      canvas.style.touchAction = '';
    }
  }

  function applyJoystickLayout() {
    if (!joystick) return;
    joystick.style.display = 'none';
  }

  function startHeist() {
    if (state.run && !state.run.ended) return;

    hideHomeworkPopup();
    closeQuestionModal();
    closeConfirmPopup();
    resetMovementKeys();
    resetPointerInput();

    showScreen('game');
    resizeCanvas();

    state.run = {
      haul: 0,
      strikes: 0,
      items: createHeistItems(),
      wrongQuestions: [],
      ended: false,
      mode: 'play',
      failVoicePool: shuffle([...assets.failVoiceFiles])
    };

    buildScaledRunData(state.run);
    state.activeItem = null;

    state.player = {
      x: sx(1410),
      y: sy(1280),
      direction: 'south',
      moving: false,
      visible: true,
      controlLocked: false,
      walkFrameIndex: 0,
      walkFrameTimer: 0,
      action: null
    };

    const guardDoor = getGuardDoorZone();
    state.guard = {
      x: (guardDoor.x1 + guardDoor.x2) / 2,
      y: guardDoor.y2,
      direction: 'south-west',
      active: false,
      visible: true,
      mode: 'run',
      frameIndex: 0,
      frameTimer: 0,
      moving: false
    };

    state.audio.sirenStarted = false;
    state.audio.withMePlayed = false;
    state.audio.withMeFinished = true;

    stopAllGameAudio();
    safeRestartAudio(assets.backgroundMusic, 0.22);

    updateRunStats();
    showBanner('Heist started.');

    requestGameFullscreen();
  }

  function interact() {
    if (!state.run || state.run.ended) return;
    if (state.player.controlLocked || state.player.action) return;
    if (isConfirmPopupOpen()) return;

    const exit = getExitZone();
    const playerPoint = getPlayerInteractPoint();

    if (
      (state.run.mode === 'play' || state.run.mode === 'chase') &&
      pointInRect(playerPoint.x, playerPoint.y, exit)
    ) {
      if (state.run.haul <= 0) {
        showBanner('You need some stolen art before escaping.');
        return;
      }

      openConfirmPopup({
        title: 'Leave the Museum?',
        text: `Are you sure you want to leave? You'll bank ${formatMoney(state.run.haul)}.`,
        onConfirm: () => {
          state.player.controlLocked = true;
          state.run.mode = 'escape';
          state.player.direction = 'south';
          showBanner('Escaping...');
        }
      });
      return;
    }

    if (state.run.mode !== 'play') return;

    const item = getNearbyItem();
    if (!item) {
      showBanner('Nothing to interact with here.');
      return;
    }

    const q = chooseQuestionForItem(item);
    if (!q) {
      showBanner('No unused questions left.');
      return;
    }

    state.activeItem = item;
    questionTextEl.textContent = `${q.question} (${formatMoney(Number(q.value || 0))})`;
    answerInput.value = '';
    questionModal.classList.remove('hidden');
    resetPointerInput();
    window.scrollTo(0, 0);

    setTimeout(() => {
      try {
        answerInput.focus({ preventScroll: true });
      } catch (_) {
        answerInput.focus();
      }
    }, 0);
  }

  function submitAnswer() {
    if (!state.activeItem) return;

    const item = state.activeItem;
    const q = item.question;

    if (!q) {
      closeQuestionModal();
      return;
    }

    const input = answerInput.value;
    closeQuestionModal();

    markQuestionUsed(q.id);

    if (isAnswerCorrect(input, q)) {
      startPullAnimation(item);
    } else {
      item.status = 'failed';
      state.run.strikes += 1;
      recordWrongQuestion(q);
      updateRunStats();
      flashWrong();
      playRandomFailVoice();
      showBanner('Wrong answer. Security alert increased.');

      if (state.run.strikes >= 3) {
        triggerGuardChase();
      }
    }

    state.activeItem = null;
  }

  function getDirectionalInput(speed) {
    let dx = 0;
    let dy = 0;

    if (hasKeyboardInput()) {
      if (state.keys.left) dx -= speed;
      if (state.keys.right) dx += speed;
      if (state.keys.up) dy -= speed;
      if (state.keys.down) dy += speed;
      return normalizeVector(dx, dy, speed);
    }

    if (state.pointer.active) {
      dx = state.pointer.dragX;
      dy = state.pointer.dragY;

      if (dx !== 0 || dy !== 0) {
        return {
          dx: dx * speed,
          dy: dy * speed
        };
      }
    }

    return { dx: 0, dy: 0 };
  }

  function update(delta) {
    updateFX(delta);

    if (state.screen !== 'game' || !state.run || state.run.ended) return;
    if (!questionModal.classList.contains('hidden') && state.run.mode === 'play') return;
    if (isConfirmPopupOpen()) return;

    state.player.moving = false;
    state.guard.moving = false;

    if (state.run.mode === 'play') {
      const move = getDirectionalInput(getMoveSpeed());

      if (move.dx !== 0 || move.dy !== 0) {
        state.player.moving = true;
        state.player.direction = vectorToDirection(move.dx, move.dy);
        tryMove(move.dx, move.dy);
      }

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'pull') {
      updatePullAnimation(delta);
      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'chase') {
      const move = getDirectionalInput(constants.CHASE_PLAYER_SPEED);

      if (move.dx !== 0 || move.dy !== 0) {
        state.player.moving = true;
        state.player.direction = vectorToDirection(move.dx, move.dy);
        tryMove(move.dx, move.dy);
      }

      moveTowards(
        state.guard,
        state.player.x,
        state.player.y,
        constants.GUARD_CHASE_SPEED,
        vectorToDirection
      );

      if (distance(state.guard.x, state.guard.y, state.player.x, state.player.y) < getCatchDistance()) {
        state.run.mode = 'escort';
        state.player.controlLocked = true;

        if (!state.audio.withMePlayed) {
          playWithMe();
        }

        showBanner('Caught! Escorted out.');
      }

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'escort') {
      state.guard.mode = 'walk';

      const exit = getExitZone();
      const exitCenterX = (exit.x1 + exit.x2) / 2;
      const exitCenterY = (exit.y1 + exit.y2) / 2;

      moveTowards(
        state.guard,
        exitCenterX + 18,
        exitCenterY + 8,
        constants.GUARD_ESCORT_SPEED,
        escortDirectionResolver
      );

      state.player.x = state.guard.x - 18;
      state.player.y = state.guard.y + 4;
      state.player.direction = 'south';
      state.player.moving = state.guard.moving;

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);

      if (
        pointInRect(state.player.x, state.player.y, exit) ||
        pointInRect(state.guard.x, state.guard.y, exit)
      ) {
        state.run.mode = 'escort_wait';
      }

      return;
    }

    if (state.run.mode === 'escort_wait') {
      state.player.moving = false;
      state.guard.moving = false;
      state.player.direction = 'south';
      state.guard.direction = 'south';

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);

      const exit = getExitZone();
      const exitCenterX = (exit.x1 + exit.x2) / 2;
      const exitCenterY = (exit.y1 + exit.y2) / 2;

      state.player.x = exitCenterX - 16;
      state.player.y = exitCenterY + 6;
      state.guard.x = exitCenterX + 18;
      state.guard.y = exitCenterY + 8;

      if (state.audio.withMeFinished) {
        state.player.visible = false;
        state.guard.visible = false;
        endHeist(false);
      }

      return;
    }

    if (state.run.mode === 'escape') {
      const exit = getExitZone();
      const targetX = (exit.x1 + exit.x2) / 2;
      const targetY = exit.y2 + sy(30);

      const dx = targetX - state.player.x;
      const dy = targetY - state.player.y;
      const len = Math.hypot(dx, dy) || 1;

      const mx = (dx / len) * constants.CHASE_PLAYER_SPEED;
      const my = (dy / len) * constants.CHASE_PLAYER_SPEED;

      state.player.moving = true;
      state.player.direction = vectorToDirection(mx, my);
      state.player.x += mx;
      state.player.y += my;

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);

      if (state.player.y >= exit.y2 - sy(10)) {
        state.player.visible = false;
        endHeist(true);
      }
    }
  }

  const runtime = {
    canvas,
    ctx,
    state,
    assets,
    constants,
    helpers: {
      getNearbyItem,
      getExitZone,
      pointInRect,
      getPlayerInteractPoint,
      getItemInteractPoint,
      getItemInteractRadius
    }
  };

  function drawInteractionDebug() {
    if (!DEBUG_INTERACTION || !state.run) return;

    ctx.save();

    const playerPoint = getPlayerInteractPoint();
    ctx.strokeStyle = 'rgba(0,255,0,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(playerPoint.x, playerPoint.y, 10, 0, Math.PI * 2);
    ctx.stroke();

    state.run.items.forEach((item) => {
      if (item.status === 'stolen') return;

      const p = getItemInteractPoint(item);
      const r = getItemInteractRadius(item);

      ctx.strokeStyle = 'rgba(255,0,0,0.95)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,0,0,0.18)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.id, p.x, p.y - r - 6);
    });

    ctx.restore();
  }

  function gameLoop(timestamp) {
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const delta = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;

    try {
      update(delta);
      drawRoom(runtime);
      drawInteractionDebug();
    } catch (err) {
      console.error(err);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Game error - check console', canvas.width / 2, canvas.height / 2);
    }

    requestAnimationFrame(gameLoop);
  }

  answerInput.style.fontSize = '16px';
  answerInput.style.lineHeight = '1.2';
  answerInput.style.transform = 'translateZ(0)';
  answerInput.autocapitalize = 'off';
  answerInput.autocomplete = 'off';
  answerInput.spellcheck = false;

  document.addEventListener(
    'touchmove',
    (e) => {
      if (state.screen === 'game') {
        const tag = (e.target?.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
        }
      }
    },
    { passive: false }
  );

  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();

    if (k === 'arrowup' || k === 'w') state.keys.up = true;
    if (k === 'arrowdown' || k === 's') state.keys.down = true;
    if (k === 'arrowleft' || k === 'a') state.keys.left = true;
    if (k === 'arrowright' || k === 'd') state.keys.right = true;

    if (k === 'enter' && questionModal.classList.contains('hidden') && state.screen === 'game' && !isConfirmPopupOpen()) {
      e.preventDefault();
      interact();
    }

    if (k === 'enter' && !questionModal.classList.contains('hidden')) {
      e.preventDefault();
      submitAnswer();
    }

    if (k === 'escape') {
      hideHomeworkPopup();
      closeConfirmPopup();
      resetPointerInput();
    }
  });

  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();

    if (k === 'arrowup' || k === 'w') state.keys.up = false;
    if (k === 'arrowdown' || k === 's') state.keys.down = false;
    if (k === 'arrowleft' || k === 'a') state.keys.left = false;
    if (k === 'arrowright' || k === 'd') state.keys.right = false;
  });

  joystickButtons.forEach((btn) => {
    const dir = btn.dataset.dir;
    const map = { up: 'up', down: 'down', left: 'left', right: 'right' };

    const press = (val) => {
      state.keys[map[dir]] = val;
    };

    btn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        press(true);
      },
      { passive: false }
    );

    btn.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        press(false);
      },
      { passive: false }
    );

    btn.addEventListener(
      'touchcancel',
      (e) => {
        e.preventDefault();
        press(false);
      },
      { passive: false }
    );

    btn.addEventListener('mousedown', () => press(true));
    btn.addEventListener('mouseup', () => press(false));
    btn.addEventListener('mouseleave', () => press(false));
  });

  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (state.screen !== 'game') return;
      e.preventDefault();
      startPointerControl(e);
    },
    { passive: false }
  );

  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (!state.pointer.active) return;
      e.preventDefault();
      updatePointerControl(e);
    },
    { passive: false }
  );

  canvas.addEventListener(
    'pointerup',
    (e) => {
      e.preventDefault();
      endPointerControl(e);
    },
    { passive: false }
  );

  canvas.addEventListener(
    'pointercancel',
    (e) => {
      e.preventDefault();
      endPointerControl(e);
    },
    { passive: false }
  );

  canvas.addEventListener(
    'pointerleave',
    (e) => {
      if (state.pointer.active && e.pointerType === 'mouse') {
        endPointerControl(e);
      }
    },
    { passive: false }
  );

  canvas.addEventListener('contextmenu', (e) => {
    if (state.screen === 'game') e.preventDefault();
  });

  if (interactBtn) interactBtn.addEventListener('click', interact);

  if (backToHubBtn) {
    backToHubBtn.addEventListener('click', handleReturnToBase);
  }

  if (submitAnswerBtn) submitAnswerBtn.addEventListener('click', submitAnswer);

  if (cancelAnswerBtn) {
    cancelAnswerBtn.addEventListener('click', () => {
      closeQuestionModal();
      resetPointerInput();
    });
  }

  if (summaryContinueBtn) {
    summaryContinueBtn.addEventListener('click', returnToHub);
  }

  window.addEventListener('resize', resizeCanvas);
  document.addEventListener('fullscreenchange', () => {
    setTimeout(resizeCanvas, 60);
  });

  showScreen('hub');
  applyJoystickLayout();
  ensureHomeworkPopup();
  ensureConfirmPopup();
  resizeCanvas();
  maybeShowHomeworkPopup();
  requestAnimationFrame(gameLoop);

  return {
    startHeist
  };
}
