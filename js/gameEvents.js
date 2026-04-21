import {
  endPointerControl,
  getCanvasPointFromEvent,
  resetPointerInput,
  startPointerControl,
  updatePointerControl
} from './input.js';

export function registerGameEvents(context, deps) {
  const { state, refs, sx, constants } = context;
  const { ui, runtime, session } = deps;

  refs.answerInput.style.fontSize = '16px';
  refs.answerInput.style.lineHeight = '1.2';
  refs.answerInput.style.transform = 'translateZ(0)';
  refs.answerInput.autocapitalize = 'off';
  refs.answerInput.autocomplete = 'off';
  refs.answerInput.spellcheck = false;

  if (refs.cancelAnswerBtn) {
    refs.cancelAnswerBtn.style.display = 'none';
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

    if (session.isPortraitBlocked()) return;

    if (k === 'enter') {
      if (!refs.questionModal.classList.contains('hidden')) {
        e.preventDefault();
        runtime.submitAnswer();
        return;
      }

      if (
        !isTypingField &&
        refs.questionModal.classList.contains('hidden') &&
        state.screen === 'game' &&
        !ui.isConfirmPopupOpen()
      ) {
        e.preventDefault();
        runtime.interact();
      }

      return;
    }

    if (k === 'escape') {
      if (!refs.questionModal.classList.contains('hidden')) return;
      ui.hideHomeworkPopup();
      ui.closeConfirmPopup();
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

  refs.canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (state.screen !== 'game') return;
      if (session.isPortraitBlocked()) return;

      const point = getCanvasPointFromEvent(refs.canvas, e, context.view.width, context.view.height);
      const prompt = runtime.getPromptBounds();

      if (
        prompt &&
        !state.player.controlLocked &&
        !state.player.action &&
        !ui.isConfirmPopupOpen() &&
        refs.questionModal.classList.contains('hidden') &&
        runtime.pointInSimpleRect(point.x, point.y, prompt)
      ) {
        e.preventDefault();
        runtime.interact();
        return;
      }

      e.preventDefault();
      startPointerControl({
        state,
        canvas: refs.canvas,
        e,
        viewW: context.view.width,
        viewH: context.view.height,
        questionModalOpen: !refs.questionModal.classList.contains('hidden'),
        confirmOpen: ui.isConfirmPopupOpen()
      });
    },
    { passive: false }
  );

  refs.canvas.addEventListener(
    'pointermove',
    (e) => {
      if (session.isPortraitBlocked()) return;
      if (!state.pointer.active) return;

      e.preventDefault();
      updatePointerControl({
        state,
        e,
        canvas: refs.canvas,
        viewW: context.view.width,
        viewH: context.view.height,
        deadzoneRadius: sx(constants.POINTER_DEADZONE)
      });
    },
    { passive: false }
  );

  refs.canvas.addEventListener(
    'pointerup',
    (e) => {
      e.preventDefault();
      endPointerControl(state, e);
    },
    { passive: false }
  );

  refs.canvas.addEventListener(
    'pointercancel',
    (e) => {
      e.preventDefault();
      endPointerControl(state, e);
    },
    { passive: false }
  );

  refs.canvas.addEventListener(
    'pointerleave',
    (e) => {
      if (state.pointer.active && e.pointerType === 'mouse') {
        endPointerControl(state, e);
      }
    },
    { passive: false }
  );

  refs.canvas.addEventListener('contextmenu', (e) => {
    if (state.screen === 'game') e.preventDefault();
  });

  if (refs.backToHubBtn) {
    refs.backToHubBtn.addEventListener('click', session.handleReturnToBase);
  }

  if (refs.submitAnswerBtn) {
    refs.submitAnswerBtn.addEventListener('click', runtime.submitAnswer);
  }

  if (refs.summaryContinueBtn) {
    refs.summaryContinueBtn.addEventListener('click', session.requestReturnToHub);
  }

  if (refs.homeworkCloseBtn) {
    refs.homeworkCloseBtn.addEventListener('click', ui.hideHomeworkPopup);
  }

  refs.confirmChoiceOverlay.addEventListener('click', (e) => {
    if (e.target !== refs.confirmChoiceOverlay) return;
    const cancelFn = state.confirm.onCancel;
    ui.closeConfirmPopup();
    if (typeof cancelFn === 'function') cancelFn();
  });

  if (refs.confirmChoiceYesBtn) {
    refs.confirmChoiceYesBtn.addEventListener('click', () => {
      const confirmFn = state.confirm.onConfirm;
      ui.closeConfirmPopup();
      if (typeof confirmFn === 'function') confirmFn();
    });
  }

  if (refs.confirmChoiceNoBtn) {
    refs.confirmChoiceNoBtn.addEventListener('click', () => {
      const cancelFn = state.confirm.onCancel;
      ui.closeConfirmPopup();
      if (typeof cancelFn === 'function') cancelFn();
    });
  }

  refs.homeworkOverlay.addEventListener('click', (e) => {
    if (e.target === refs.homeworkOverlay) {
      ui.hideHomeworkPopup();
    }
  });

  window.addEventListener('resize', () => {
    runtime.resizeCanvas();
    session.updateOrientationState();
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      runtime.resizeCanvas();
      session.updateOrientationState();
    }, 120);
  });

  document.addEventListener('fullscreenchange', () => {
    setTimeout(() => {
      runtime.resizeCanvas();
      session.updateOrientationState();
    }, 60);
  });

  window.addEventListener('nanaheist:settings-updated', () => {
    session.resumeRuntimeAudio();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      session.pauseRuntimeAudio();
      ui.pauseQuestionTimer();
      return;
    }

    session.resumeRuntimeAudio();
    ui.resumeQuestionTimer(runtime.submitAnswer);
  });

  window.addEventListener('pagehide', () => {
    session.pauseRuntimeAudio();
    ui.pauseQuestionTimer();
  });

  window.addEventListener('pageshow', () => {
    session.resumeRuntimeAudio();
    ui.resumeQuestionTimer(runtime.submitAnswer);
  });

  window.addEventListener('focus', () => {
    session.resumeRuntimeAudio();
    ui.resumeQuestionTimer(runtime.submitAnswer);
  });

  window.addEventListener('beforeunload', () => {
    session.stopAllRuntimeAudio();
    ui.stopQuestionTimer();
  });
}
