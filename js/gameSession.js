import { applyGameAudioSettings, pauseAudio, safePlayAudio, safeRestartAudio, unlockAudioContext } from './audio.js';
import { createGuardState, createPlayerState, createRunState } from './gameState.js';
import { buildScaledRunData, createHeistItems } from './items.js';
import { endHeist, formatMoney, stopAllGameAudio } from './gameFlow.js';
import {
  isMobileLike,
  requestGameFullscreen,
  resetMovementKeys,
  resetPointerInput
} from './input.js';

function resetRuntimeInputs(state) {
  resetMovementKeys(state);
  resetPointerInput(state);
}

export function createGameSession(context, deps) {
  const { state, assets, refs, sx, sy } = context;
  const { ui, runtime } = deps;

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
    document.body.style.width = '100vw';
    document.body.style.height = 'var(--app-height)';
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

  function pauseRuntimeAudio() {
    pauseAudio(assets.backgroundMusic);
    pauseAudio(assets.sirenSound);
    pauseAudio(assets.withMeSound);
    pauseAudio(assets.heyStopSound);
    pauseAudio(assets.chaChingSound);
  }

  function stopAllRuntimeAudio() {
    stopAllGameAudio(assets);
  }

  function canResumeMidClip(audio) {
    return !!audio && !audio.ended && audio.paused && audio.currentTime > 0;
  }

  function resumeRuntimeAudio() {
    if (document.hidden) return;
    if (state.screen !== 'game') return;
    if (!state.run || state.run.ended) return;
    if (isPortraitBlocked()) return;

    applyGameAudioSettings(assets);
    unlockAudioContext();

    if (canResumeMidClip(assets.withMeSound)) {
      safePlayAudio(assets.withMeSound);
      return;
    }

    if (canResumeMidClip(assets.heyStopSound)) {
      safePlayAudio(assets.heyStopSound);
      return;
    }

    if (canResumeMidClip(assets.chaChingSound)) {
      safePlayAudio(assets.chaChingSound);
    }

    if (['chase', 'escort', 'escort_wait'].includes(state.run.mode)) {
      safePlayAudio(assets.sirenSound);
      return;
    }

    if (canResumeMidClip(assets.backgroundMusic)) {
      safePlayAudio(assets.backgroundMusic);
      return;
    }

    safePlayAudio(assets.backgroundMusic);
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

    await requestGameFullscreen(refs.gameScreen || document.documentElement);
    await tryLockLandscape();

    setTimeout(() => {
      window.scrollTo(0, 0);
      runtime.resizeCanvas();
    }, 50);

    setTimeout(() => {
      window.scrollTo(0, 0);
      runtime.resizeCanvas();
    }, 250);
  }

  async function updateOrientationState() {
    const blocked = isPortraitBlocked();

    if (refs.rotateDeviceOverlay) {
      refs.rotateDeviceOverlay.classList.toggle('hidden', !blocked);
    }

    document.body.classList.toggle('orientation-blocked', blocked);

    if (blocked) {
      resetPointerInput(state);
      state.player.moving = false;
      state.guard.moving = false;
      pauseRuntimeAudio();
      return;
    }

    runtime.resizeCanvas();

    if (state.screen === 'game') {
      await tryFullscreenAndLandscape();
      resumeRuntimeAudio();
    }
  }

  function showScreen(name) {
    state.screen = name;

    if (refs.hubScreen) refs.hubScreen.classList.toggle('active', name === 'hub');
    if (refs.gameScreen) refs.gameScreen.classList.toggle('active', name === 'game');

    if (name === 'game') {
      lockPageForGame();
      refs.canvas.style.touchAction = 'none';
      window.scrollTo(0, 0);
      runtime.resizeCanvas();
      applyGameAudioSettings(assets);

      if (!isPortraitBlocked()) {
        tryFullscreenAndLandscape();
      }
    } else {
      stopAllRuntimeAudio();
      unlockPageFromGame();
      refs.canvas.style.touchAction = '';
      window.scrollTo(0, 0);
      ui.stopQuestionTimer();
    }
  }

  function startHeist() {
    if (state.run && !state.run.ended) return;

    ui.hideHomeworkPopup();
    ui.closeQuestionModal();
    ui.closeConfirmPopup();
    resetRuntimeInputs(state);

    showScreen('game');
    runtime.resizeCanvas();

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

    const guardDoorCenter = runtime.getGuardDoorCenter();
    const guardDoorBottomY = runtime.getGuardDoorBottomY();

    state.guard = createGuardState(
      guardDoorCenter.x,
      guardDoorBottomY
    );

    state.audio.sirenStarted = false;
    state.audio.withMePlayed = false;
    state.audio.withMeFinished = true;

    stopAllRuntimeAudio();
    applyGameAudioSettings(assets);
    safeRestartAudio(assets.backgroundMusic);

    ui.updateRunStats();
    ui.showBanner('Heist started.');

    if (!isPortraitBlocked()) {
      tryFullscreenAndLandscape();
    }
  }

  function requestReturnToHub() {
    stopAllRuntimeAudio();
    ui.closeQuestionModal();
    ui.closeConfirmPopup();
    resetRuntimeInputs(state);

    if (refs.summaryOverlay) {
      refs.summaryOverlay.classList.add('hidden');
    }

    state.run = null;
    state.activeItem = null;
    state.player.action = null;

    showScreen('hub');
    ui.maybeShowHomeworkPopup();
  }

  function handleReturnToBase() {
    if (!state.run || state.run.ended) {
      showScreen('hub');
      return;
    }

    ui.openConfirmPopup({
      title: 'Return to Base?',
      text: `Are you sure you want to return home? You'll lose your current haul of ${formatMoney(state.run.haul)}.`,
      onConfirm: () => {
        stopAllRuntimeAudio();
        ui.closeQuestionModal();
        resetRuntimeInputs(state);

        state.run = null;
        state.activeItem = null;
        state.player.action = null;

        showScreen('hub');
        ui.maybeShowHomeworkPopup();
      }
    });
  }

  function handleEscapeRequest() {
    if (!state.run || state.run.ended) return;
    if (ui.isConfirmPopupOpen()) return;
    if (state.player.controlLocked || state.player.action) return;
    if (state.run.mode !== 'play') return;

    if (state.run.haul <= 0) {
      ui.showBanner('You need some stolen art before escaping.');
      return;
    }

    state.player.controlLocked = true;

    ui.openConfirmPopup({
      title: 'Leave the Museum?',
      text: `Are you sure you want to leave now? You have earned ${formatMoney(state.run.haul)} this heist.`,
      onConfirm: () => {
        stopAllRuntimeAudio();
        endHeist({
          state,
          escaped: true,
          showScreen,
          maybeShowHomeworkPopup: ui.maybeShowHomeworkPopup,
          showBanner: ui.showBanner,
          closeQuestionModal: ui.closeQuestionModal,
          closeConfirmPopup: ui.closeConfirmPopup,
          resetMovementKeys: () => resetMovementKeys(state),
          resetPointerInput: () => resetPointerInput(state),
          summaryOverlay: refs.summaryOverlay,
          updateHubSave: ui.updateHubSave
        });
      },
      onCancel: () => {
        state.player.controlLocked = false;
        state.run.wasInExitZone = true;
      }
    });
  }

  function handleCaughtEscortComplete() {
    if (!state.run) return;

    stopAllRuntimeAudio();
    endHeist({
      state,
      escaped: false,
      showScreen,
      maybeShowHomeworkPopup: ui.maybeShowHomeworkPopup,
      showBanner: ui.showBanner,
      closeQuestionModal: ui.closeQuestionModal,
      closeConfirmPopup: ui.closeConfirmPopup,
      resetMovementKeys: () => resetMovementKeys(state),
      resetPointerInput: () => resetPointerInput(state),
      summaryOverlay: refs.summaryOverlay,
      updateHubSave: ui.updateHubSave
    });

    ui.closeQuestionModal();
    ui.closeConfirmPopup();
    resetRuntimeInputs(state);

    state.run = null;
    state.activeItem = null;
    state.player.action = null;
    state.player.controlLocked = false;
    state.player.moving = false;
    state.player.visible = true;
    state.guard.active = false;
    state.guard.visible = true;

    if (refs.summaryOverlay) {
      refs.summaryOverlay.classList.add('hidden');
    }

    showScreen('hub');
    ui.maybeShowHomeworkPopup();
    ui.showBanner('Caught! Better luck next heist.');
  }

  return {
    isPortraitBlocked,
    pauseRuntimeAudio,
    stopAllRuntimeAudio,
    resumeRuntimeAudio,
    updateOrientationState,
    showScreen,
    startHeist,
    requestReturnToHub,
    handleReturnToBase,
    handleEscapeRequest,
    handleCaughtEscortComplete
  };
}
