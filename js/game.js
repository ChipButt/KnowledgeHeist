import { clearLastHeistWrong, loadSettings } from './storage.js';
import { createAssets } from './assets.js';
import { applyGameAudioSettings, safeRestartAudio } from './audio.js';
import { createBaseState, createGuardState, createPlayerState, createRunState } from './gameState.js';
import { drawRoom, getPromptBounds } from './render.js';
import { drawInteractionDebug, drawLayoutOverlay } from './debug.js';
import {
  createScaler,
  getExitZone,
  getFloorPoly,
  getGuardDoorZone,
  pointInPolygon,
  pointInRect
} from './zones.js';
import {
  buildScaledRunData,
  createHeistItems,
  getItemInteractPoint,
  getItemInteractRadius,
  getItemInteractZone,
  pointHitsFloorBlocker
} from './items.js';
import {
  askQuestionForItem,
  endHeist,
  formatMoney,
  getNearbyItem,
  getPlayerInteractPoint,
  playWithMe,
  stopAllGameAudio,
  submitAnswer as submitAnswerFlow,
  updateFX,
  updatePullAnimation
} from './gameFlow.js';
import {
  endPointerControl,
  getCanvasPointFromEvent,
  getDirectionalInput,
  getMoveSpeed,
  requestGameFullscreen,
  resetMovementKeys,
  resetPointerInput,
  startPointerControl,
  updatePointerControl
} from './input.js';

const REVIEW_TAGLINES = [
  'Every day is a school day.',
  'Failing is a great way to learn.',
  'Even master thieves revise their notes.',
  'That one goes in the notebook.',
  'Progress beats perfection.',
  'A rough heist still teaches good lessons.',
  'Better to learn it here than on the big score.',
  'Field research complete.',
  'A wobble now means a cleaner run later.',
  'Consider this practical training.',
  'Every mistake is future profit in disguise.',
  'The review is where the next win begins.',
  'Not your cleanest run, but still useful.',
  'Even legends need a debrief.',
  'Sharp minds are built on retries.',
  'Experience has been successfully collected.',
  'Next time Nana walks in wiser.',
  'A missed answer is still a gained note.',
  'Good thieves adapt.',
  'The comeback starts with the review.'
];

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
  const summaryContinueBtn = document.getElementById('summaryContinueBtn');

  const banner = document.getElementById('gameBanner');
  const rotateDeviceOverlay = document.getElementById('rotateDeviceOverlay');

  const confirmChoiceOverlay = document.getElementById('confirmChoiceOverlay');
  const homeworkOverlay = document.getElementById('homeworkOverlay');
  const homeworkCloseBtn = document.getElementById('homeworkCloseBtn');
  const homeworkTitle = document.getElementById('homeworkTitle');
  const homeworkSub = homeworkOverlay?.querySelector('.chalk-sub');

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) throw new Error('Missing #gameCanvas');

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');

  const assets = createAssets();
  applyGameAudioSettings(assets);

  const constants = {
    MOVE_SPEED_DESKTOP: 2.35,
    MOVE_SPEED_MOBILE: 2.45,
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

    POINTER_DEADZONE: 14,
    CATCH_DISTANCE: 28,

    PLAYER_DRAW_H: 100,
    PLAYER_DRAW_Y_OFFSET: 10,
    PLAYER_FEET_POINT_Y: 0.63,

    HARD_MODE_ANSWER_MS: 20000
  };

  const state = createBaseState();

  let VIEW_W = canvas.width;
  let VIEW_H = canvas.height;

  const scaler = createScaler(() => ({ width: VIEW_W, height: VIEW_H }));
  const sx = scaler.sx;
  const sy = scaler.sy;

  let questionTimerInterval = null;
  let questionDeadlineTs = 0;

  function isMobileLike() {
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.innerWidth < 900
    );
  }

  function isPortraitBlocked() {
    return isMobileLike() && window.innerHeight > window.innerWidth;
  }

  function lockPageForGame() {
    document.body.classList.add('game-active');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';
    document.body.style.position = 'fixed';
    document.body.style.inset = '0';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
  }

  function unlockPageFromGame() {
    document.body.classList.remove('game-active');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.touchAction = '';
    document.body.style.position = '';
    document.body.style.inset = '';
    document.body.style.width = '';
    document.body.style.height = '';
  }

  function stopAllRuntimeAudio() {
    stopAllGameAudio(assets);
  }

  function getQuestionTimerEl() {
    let el = document.getElementById('questionTimer');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'questionTimer';
    el.className = 'question-timer';
    questionTextEl.insertAdjacentElement('afterend', el);
    return el;
  }

  function stopQuestionTimer() {
    if (questionTimerInterval) {
      clearInterval(questionTimerInterval);
      questionTimerInterval = null;
    }
    questionDeadlineTs = 0;

    const el = document.getElementById('questionTimer');
    if (el) {
      el.textContent = '';
      el.classList.remove('show');
    }
  }

  function updateQuestionTimerUI() {
    const el = getQuestionTimerEl();
    if (!questionDeadlineTs) {
      el.textContent = '';
      el.classList.remove('show');
      return;
    }

    const remainingMs = Math.max(0, questionDeadlineTs - Date.now());
    const seconds = Math.ceil(remainingMs / 1000);
    el.textContent = `Time remaining: ${seconds}s`;
    el.classList.add('show');
  }

  function startQuestionTimerIfNeeded() {
    stopQuestionTimer();

    if (loadSettings().difficulty !== 'hard') return;
    if (questionModal.classList.contains('hidden')) return;

    questionDeadlineTs = Date.now() + constants.HARD_MODE_ANSWER_MS;
    updateQuestionTimerUI();

    questionTimerInterval = setInterval(() => {
      const remainingMs = questionDeadlineTs - Date.now();

      if (remainingMs <= 0) {
        stopQuestionTimer();
        submitAnswer();
        return;
      }

      updateQuestionTimerUI();
    }, 250);
  }

  async function tryLockLandscape() {
    try {
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        await screen.orientation.lock('landscape');
      }
    } catch (_) {}
  }

  async function tryFullscreenAndLandscape() {
    if (!isMobileLike()) return;

    lockPageForGame();
    window.scrollTo(0, 0);

    await requestGameFullscreen(gameScreen || document.documentElement);
    await tryLockLandscape();

    setTimeout(() => {
      window.scrollTo(0, 0);
      resizeCanvas();
    }, 50);

    setTimeout(() => {
      window.scrollTo(0, 0);
      resizeCanvas();
    }, 250);
  }

  async function updateOrientationState() {
    const blocked = isPortraitBlocked();

    if (rotateDeviceOverlay) {
      rotateDeviceOverlay.classList.toggle('hidden', !blocked);
    }

    document.body.classList.toggle('orientation-blocked', blocked);

    if (blocked) {
      resetPointerInput(state);
      state.player.moving = false;
      state.guard.moving = false;
      return;
    }

    resizeCanvas();

    if (state.screen === 'game') {
      await tryFullscreenAndLandscape();
    }
  }

  function getFloorPolyNow() {
    return getFloorPoly(sx, sy);
  }

  function getExitZoneNow() {
    return getExitZone(sx, sy);
  }

  function getGuardDoorZoneNow() {
    return getGuardDoorZone(sx, sy);
  }

  function getGuardDoorCenter() {
    const zone = getGuardDoorZoneNow();
    if (zone.type === 'poly') {
      const total = zone.points.reduce(
        (acc, point) => {
          acc.x += point.x;
          acc.y += point.y;
          return acc;
        },
        { x: 0, y: 0 }
      );

      return {
        x: total.x / zone.points.length,
        y: total.y / zone.points.length
      };
    }

    return {
      x: (zone.x1 + zone.x2) / 2,
      y: (zone.y1 + zone.y2) / 2
    };
  }

  function getGuardDoorBottomY() {
    const zone = getGuardDoorZoneNow();
    if (zone.type === 'poly') {
      return Math.max(...zone.points.map((point) => point.y));
    }
    return zone.y2;
  }

  function getPlayerFeetPoint() {
    return getPlayerInteractPoint(
      state,
      constants.PLAYER_DRAW_H,
      constants.PLAYER_DRAW_Y_OFFSET,
      constants.PLAYER_FEET_POINT_Y
    );
  }

  function getPlayerFeetPointForPosition(x, y) {
    const drawTopY = y - constants.PLAYER_DRAW_H - constants.PLAYER_DRAW_Y_OFFSET;

    return {
      x,
      y: drawTopY + (constants.PLAYER_DRAW_H * constants.PLAYER_FEET_POINT_Y)
    };
  }

  function getCatchDistance() {
    return Math.max(18, sx(constants.CATCH_DISTANCE));
  }

  function pointInSimpleRect(px, py, rect) {
    return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
  }

  function vectorToDirection(dx, dy) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX < 0.001 && absY < 0.001) return 'south';

    if (absX > absY * 1.8) return dx > 0 ? 'east' : 'west';
    if (absY > absX * 1.8) return dy > 0 ? 'south' : 'north';

    if (dx > 0 && dy < 0) return 'north-east';
    if (dx < 0 && dy < 0) return 'north-west';
    if (dx > 0 && dy > 0) return 'south-east';
    if (dx < 0 && dy > 0) return 'south-west';

    if (dx > 0) return 'east';
    if (dx < 0) return 'west';
    if (dy < 0) return 'north';
    return 'south';
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

  function updateHubSave() {
    window.dispatchEvent(new CustomEvent('nanaheist:data-updated'));
  }

  function isWalkablePoint(x, y, options = {}) {
    if (!pointInPolygon({ x, y }, getFloorPolyNow())) return false;
    if (!options.ignoreFloorBlockers && state.run && pointHitsFloorBlocker(state.run.items, x, y)) return false;
    return true;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    canvas.width = width;
    canvas.height = height;

    VIEW_W = width;
    VIEW_H = height;

    if (state.run) {
      buildScaledRunData(state.run, sx, sy);
    }
  }

  function isConfirmPopupOpen() {
    return state.confirm.open;
  }

  function closeQuestionModal() {
    questionModal.classList.add('hidden');
    state.activeItem = null;
    stopQuestionTimer();
    answerInput.blur();
  }

  function openConfirmPopup({ title, text, onConfirm, onCancel }) {
    state.confirm.open = true;
    state.confirm.onConfirm = onConfirm || null;
    state.confirm.onCancel = onCancel || null;

    document.getElementById('confirmChoiceTitle').textContent = title;
    document.getElementById('confirmChoiceText').textContent = text;
    confirmChoiceOverlay.classList.remove('hidden');
  }

  function closeConfirmPopup() {
    confirmChoiceOverlay.classList.add('hidden');
    state.confirm.open = false;
    state.confirm.onConfirm = null;
    state.confirm.onCancel = null;
  }

  function maybeShowHomeworkPopup() {
    if (!state.homework.pending.length || state.screen !== 'hub') return;

    if (homeworkTitle) {
      homeworkTitle.textContent = 'Heist Review';
    }

    if (homeworkSub) {
      homeworkSub.textContent =
        REVIEW_TAGLINES[Math.floor(Math.random() * REVIEW_TAGLINES.length)];
    }

    const list = document.getElementById('homeworkList');
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

    homeworkOverlay.classList.remove('hidden');
  }

  function hideHomeworkPopup() {
    homeworkOverlay.classList.add('hidden');
    state.homework.pending = [];
    clearLastHeistWrong();
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

  function tryMove(dx, dy, options = {}) {
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;
    const nextFeet = getPlayerFeetPointForPosition(nx, ny);

    if (!pointInPolygon(nextFeet, getFloorPolyNow())) return;
    if (
      !options.ignoreBlockers &&
      state.run &&
      pointHitsFloorBlocker(state.run.items, nextFeet.x, nextFeet.y)
    ) {
      return;
    }

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

  function openExitConfirm() {
    if (!state.run || state.run.ended) return;
    if (isConfirmPopupOpen()) return;
    if (state.player.controlLocked || state.player.action) return;
    if (state.run.mode !== 'play') return;

    if (state.run.haul <= 0) {
      showBanner('You need some stolen art before escaping.');
      return;
    }

    state.player.controlLocked = true;

    openConfirmPopup({
      title: 'Leave the Museum?',
      text: `Are you sure you want to leave now? You have earned ${formatMoney(state.run.haul)} this heist.`,
      onConfirm: () => {
        stopAllGameAudio(assets);
        endHeist({
          state,
          escaped: true,
          showScreen,
          maybeShowHomeworkPopup,
          showBanner,
          closeQuestionModal,
          closeConfirmPopup,
          resetMovementKeys: () => resetMovementKeys(state),
          resetPointerInput: () => resetPointerInput(state),
          summaryOverlay,
          updateHubSave
        });
      },
      onCancel: () => {
        state.player.controlLocked = false;
        state.run.wasInExitZone = true;
      }
    });
  }

  function updateExitZoneTrigger() {
    if (!state.run || state.run.ended) return;
    if (state.run.mode !== 'play') return;
    if (isConfirmPopupOpen()) return;

    const exit = getExitZoneNow();
    const playerPoint = getPlayerFeetPoint();
    const expandedExit = {
      x1: exit.x1,
      y1: exit.y1 - sy(70),
      x2: exit.x2,
      y2: exit.y2
    };

    const isInExitZone = pointInRect(playerPoint.x, playerPoint.y, expandedExit);

    if (isInExitZone && !state.run.wasInExitZone) {
      openExitConfirm();
    }

    state.run.wasInExitZone = isInExitZone;
  }

  function returnCaughtToHub() {
    if (!state.run) return;

    closeQuestionModal();
    closeConfirmPopup();
    resetMovementKeys(state);
    resetPointerInput(state);

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
    stopAllGameAudio(assets);
    closeQuestionModal();
    closeConfirmPopup();
    resetMovementKeys(state);
    resetPointerInput(state);

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
        stopAllGameAudio(assets);
        closeQuestionModal();
        resetMovementKeys(state);
        resetPointerInput(state);

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
      lockPageForGame();
      canvas.style.touchAction = 'none';
      window.scrollTo(0, 0);
      resizeCanvas();
      applyGameAudioSettings(assets);

      if (!isPortraitBlocked()) {
        tryFullscreenAndLandscape();
      }
    } else {
      stopAllGameAudio(assets);
      unlockPageFromGame();
      canvas.style.touchAction = '';
      window.scrollTo(0, 0);
      stopQuestionTimer();
    }
  }

  function startHeist() {
    if (state.run && !state.run.ended) return;

    hideHomeworkPopup();
    closeQuestionModal();
    closeConfirmPopup();
    resetMovementKeys(state);
    resetPointerInput(state);

    showScreen('game');
    resizeCanvas();

    state.run = createRunState(
      createHeistItems({
        assets,
        sx,
        sy
      }),
      [...assets.failVoiceFiles]
    );

    buildScaledRunData(state.run, sx, sy);
    state.activeItem = null;

    state.player = createPlayerState(sx(1286), sy(1409));
    state.player.direction = 'north';

    const guardDoorCenter = getGuardDoorCenter();
    const guardDoorBottomY = getGuardDoorBottomY();

    state.guard = createGuardState(
      guardDoorCenter.x,
      guardDoorBottomY
    );

    state.audio.sirenStarted = false;
    state.audio.withMePlayed = false;
    state.audio.withMeFinished = true;

    stopAllGameAudio(assets);
    applyGameAudioSettings(assets);
    safeRestartAudio(assets.backgroundMusic);

    updateRunStats();
    showBanner('Heist started.');

    if (!isPortraitBlocked()) {
      tryFullscreenAndLandscape();
    }
  }

  function interact() {
    if (isPortraitBlocked()) return;
    if (!state.run || state.run.ended) return;
    if (state.player.controlLocked || state.player.action) return;
    if (isConfirmPopupOpen()) return;
    if (state.run.mode !== 'play') return;

    const item = getNearbyItem({
      state,
      run: state.run,
      sx,
      sy,
      getPlayerInteractPointFn: getPlayerFeetPoint
    });

    if (!item) {
      showBanner('Nothing to interact with here.');
      return;
    }

    state.activeItem = item;
    const opened = askQuestionForItem({
      state,
      questionTextEl,
      answerInput,
      questionModal,
      showBanner
    });

    if (opened) {
      startQuestionTimerIfNeeded();
    }

    resetPointerInput(state);
    window.scrollTo(0, 0);
  }

  function submitAnswer() {
    if (isPortraitBlocked()) return;
    stopQuestionTimer();

    submitAnswerFlow({
      state,
      input: answerInput.value,
      closeQuestionModal,
      constants,
      assets,
      updateRunStats,
      showBanner
    });
  }

  function update(delta) {
    updateFX(state, delta);

    if (isPortraitBlocked()) return;
    if (state.screen !== 'game' || !state.run || state.run.ended) return;
    if (!questionModal.classList.contains('hidden') && state.run.mode === 'play') return;
    if (isConfirmPopupOpen()) return;

    state.player.moving = false;
    state.guard.moving = false;

    if (state.run.mode === 'play') {
      const move = getDirectionalInput(state, getMoveSpeed(constants));

      if (move.dx !== 0 || move.dy !== 0) {
        state.player.moving = true;
        state.player.direction = vectorToDirection(move.dx, move.dy);
        tryMove(move.dx, move.dy);
      }

      updateExitZoneTrigger();
      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'pull') {
      updatePullAnimation(state, delta, constants, assets, updateRunStats, showBanner);
      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'chase') {
      const move = getDirectionalInput(state, constants.CHASE_PLAYER_SPEED);

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

      if (Math.hypot(state.guard.x - state.player.x, state.guard.y - state.player.y) < getCatchDistance()) {
        state.run.mode = 'escort';
        state.player.controlLocked = true;

        if (!state.audio.withMePlayed) {
          playWithMe(state, assets);
        }

        showBanner('Caught! Escorted out.');
      }

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'escort') {
      state.guard.mode = 'walk';

      const exit = getExitZoneNow();
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

      const exit = getExitZoneNow();
      const exitCenterX = (exit.x1 + exit.x2) / 2;
      const exitCenterY = (exit.y1 + exit.y2) / 2;

      state.player.x = exitCenterX - 16;
      state.player.y = exitCenterY + 6;
      state.guard.x = exitCenterX + 18;
      state.guard.y = exitCenterY + 8;

      if (state.audio.withMeFinished) {
        state.player.visible = false;
        state.guard.visible = false;

        stopAllGameAudio(assets);
        endHeist({
          state,
          escaped: false,
          showScreen,
          maybeShowHomeworkPopup,
          showBanner,
          closeQuestionModal,
          closeConfirmPopup,
          resetMovementKeys: () => resetMovementKeys(state),
          resetPointerInput: () => resetPointerInput(state),
          summaryOverlay,
          updateHubSave
        });

        returnCaughtToHub();
      }

      return;
    }
  }

  const runtime = {
    canvas,
    ctx,
    state,
    assets,
    constants,
    helpers: {
      getNearbyItem: () =>
        getNearbyItem({
          state,
          run: state.run,
          sx,
          sy,
          getPlayerInteractPointFn: getPlayerFeetPoint
        }),
      getExitZone: getExitZoneNow,
      pointInRect,
      getPlayerInteractPoint: getPlayerFeetPoint,
      getItemInteractPoint: (item) => getItemInteractPoint(item, sx, sy),
      getItemInteractRadius: (item) => getItemInteractRadius(item, sx, sy),
      getItemInteractZone: (item) => getItemInteractZone(item, sx, sy),
      getPromptBounds: () => getPromptBounds(runtime)
    }
  };

  function gameLoop(timestamp) {
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const delta = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;

    try {
      update(delta);
      drawRoom(runtime);

      drawInteractionDebug({
        ctx,
        state,
        helpers: runtime.helpers
      });

      drawLayoutOverlay({
        ctx,
        VIEW_W,
        VIEW_H,
        helpers: runtime.helpers,
        getFloorPoly: getFloorPolyNow,
        getGuardDoorZone: getGuardDoorZoneNow
      });
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

  if (cancelAnswerBtn) {
    cancelAnswerBtn.style.display = 'none';
  }

  document.addEventListener(
    'touchmove',
    (e) => {
      if (state.screen !== 'game') return;

      const tag = (e.target?.tagName || '').toLowerCase();
      const allowInput =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select';

      if (!allowInput) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener(
    'wheel',
    (e) => {
      if (state.screen === 'game') {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  window.addEventListener('scroll', () => {
    if (state.screen === 'game') {
      window.scrollTo(0, 0);
    }
  });

  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    const tag = (e.target?.tagName || '').toLowerCase();
    const isTypingField = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (!isTypingField) {
      if (k === 'arrowup' || k === 'w') state.keys.up = true;
      if (k === 'arrowdown' || k === 's') state.keys.down = true;
      if (k === 'arrowleft' || k === 'a') state.keys.left = true;
      if (k === 'arrowright' || k === 'd') state.keys.right = true;
    }

    if (isPortraitBlocked()) return;

    if (k === 'enter') {
      if (!questionModal.classList.contains('hidden')) {
        e.preventDefault();
        submitAnswer();
        return;
      }

      if (
        !isTypingField &&
        questionModal.classList.contains('hidden') &&
        state.screen === 'game' &&
        !isConfirmPopupOpen()
      ) {
        e.preventDefault();
        interact();
        return;
      }
    }

    if (k === 'escape') {
      if (!questionModal.classList.contains('hidden')) return;
      hideHomeworkPopup();
      closeConfirmPopup();
      resetPointerInput(state);
    }
  });

  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    const tag = (e.target?.tagName || '').toLowerCase();
    const isTypingField = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (isTypingField) return;

    if (k === 'arrowup' || k === 'w') state.keys.up = false;
    if (k === 'arrowdown' || k === 's') state.keys.down = false;
    if (k === 'arrowleft' || k === 'a') state.keys.left = false;
    if (k === 'arrowright' || k === 'd') state.keys.right = false;
  });

  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (state.screen !== 'game') return;
      if (isPortraitBlocked()) return;

      const point = getCanvasPointFromEvent(canvas, e, VIEW_W, VIEW_H);
      const prompt = getPromptBounds(runtime);

      if (
        prompt &&
        !state.player.controlLocked &&
        !state.player.action &&
        !isConfirmPopupOpen() &&
        questionModal.classList.contains('hidden') &&
        pointInSimpleRect(point.x, point.y, prompt)
      ) {
        e.preventDefault();
        interact();
        return;
      }

      e.preventDefault();
      startPointerControl({
        state,
        canvas,
        e,
        viewW: VIEW_W,
        viewH: VIEW_H,
        questionModalOpen: !questionModal.classList.contains('hidden'),
        confirmOpen: isConfirmPopupOpen()
      });
    },
    { passive: false }
  );

  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (isPortraitBlocked()) return;
      if (!state.pointer.active) return;
      e.preventDefault();
      updatePointerControl({
        state,
        e,
        canvas,
        viewW: VIEW_W,
        viewH: VIEW_H,
        deadzoneRadius: sx(constants.POINTER_DEADZONE)
      });
    },
    { passive: false }
  );

  canvas.addEventListener(
    'pointerup',
    (e) => {
      e.preventDefault();
      endPointerControl(state, e);
    },
    { passive: false }
  );

  canvas.addEventListener(
    'pointercancel',
    (e) => {
      e.preventDefault();
      endPointerControl(state, e);
    },
    { passive: false }
  );

  canvas.addEventListener(
    'pointerleave',
    (e) => {
      if (state.pointer.active && e.pointerType === 'mouse') {
        endPointerControl(state, e);
      }
    },
    { passive: false }
  );

  canvas.addEventListener('contextmenu', (e) => {
    if (state.screen === 'game') e.preventDefault();
  });

  if (backToHubBtn) backToHubBtn.addEventListener('click', handleReturnToBase);
  if (submitAnswerBtn) submitAnswerBtn.addEventListener('click', submitAnswer);

  if (summaryContinueBtn) {
    summaryContinueBtn.addEventListener('click', returnToHub);
  }

  if (homeworkCloseBtn) {
    homeworkCloseBtn.addEventListener('click', hideHomeworkPopup);
  }

  confirmChoiceOverlay.addEventListener('click', (e) => {
    if (e.target !== confirmChoiceOverlay) return;
    const cancelFn = state.confirm.onCancel;
    closeConfirmPopup();
    if (typeof cancelFn === 'function') cancelFn();
  });

  document.getElementById('confirmChoiceYesBtn').addEventListener('click', () => {
    const confirmFn = state.confirm.onConfirm;
    closeConfirmPopup();
    if (typeof confirmFn === 'function') confirmFn();
  });

  document.getElementById('confirmChoiceNoBtn').addEventListener('click', () => {
    const cancelFn = state.confirm.onCancel;
    closeConfirmPopup();
    if (typeof cancelFn === 'function') cancelFn();
  });

  homeworkOverlay.addEventListener('click', (e) => {
    if (e.target === homeworkOverlay) hideHomeworkPopup();
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
    updateOrientationState();
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      resizeCanvas();
      updateOrientationState();
    }, 120);
  });

  document.addEventListener('fullscreenchange', () => {
    setTimeout(() => {
      resizeCanvas();
      updateOrientationState();
    }, 60);
  });

  window.addEventListener('nanaheist:settings-updated', () => {
    applyGameAudioSettings(assets);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAllRuntimeAudio();
      stopQuestionTimer();
    }
  });

  window.addEventListener('pagehide', () => {
    stopAllRuntimeAudio();
    stopQuestionTimer();
  });

  window.addEventListener('beforeunload', () => {
    stopAllRuntimeAudio();
    stopQuestionTimer();
  });

  window.addEventListener('blur', () => {
    stopAllRuntimeAudio();
  });

  showScreen('hub');
  resizeCanvas();
  updateOrientationState();
  requestAnimationFrame(gameLoop);

  return {
    startHeist
  };
}
