import { clearLastHeistWrong, loadSettings } from './storage.js';
import { formatMoney } from './gameFlow.js';
import { REVIEW_TAGLINES } from './gameConfig.js';

function shouldUseMobileQuestionLayout() {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.innerWidth < 900
  );
}

export function createGameUI(context) {
  const { state, refs, constants } = context;

  let questionTimerInterval = null;
  let questionDeadlineTs = 0;
  let questionRemainingMs = 0;
  let bannerTimer = null;
  let questionLayoutReady = false;

  function getQuestionTimerEl() {
    let el = document.getElementById('questionTimer');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'questionTimer';
    el.className = 'question-timer';
    refs.questionTextEl.insertAdjacentElement('afterend', el);
    return el;
  }

  function ensureQuestionLayoutStructure() {
    if (questionLayoutReady) return;

    const modalCard = refs.questionModal?.querySelector('.modal-card');
    if (!modalCard) return;

    if (modalCard.querySelector('.question-body-wrap')) {
      questionLayoutReady = true;
      return;
    }

    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'question-body-wrap';

    const scrollArea = document.createElement('div');
    scrollArea.className = 'question-scroll-area';

    const answerBar = document.createElement('div');
    answerBar.className = 'question-answer-bar';

    const title = modalCard.querySelector('h2');
    const timerEl = getQuestionTimerEl();

    if (refs.questionTextEl) scrollArea.appendChild(refs.questionTextEl);
    if (timerEl) scrollArea.appendChild(timerEl);

    if (refs.answerInput) answerBar.appendChild(refs.answerInput);
    if (refs.submitAnswerBtn) answerBar.appendChild(refs.submitAnswerBtn);

    bodyWrap.appendChild(scrollArea);
    bodyWrap.appendChild(answerBar);

    if (title && title.nextSibling) {
      modalCard.insertBefore(bodyWrap, title.nextSibling);
    } else {
      modalCard.appendChild(bodyWrap);
    }

    if (refs.cancelAnswerBtn) {
      refs.cancelAnswerBtn.hidden = true;
      refs.cancelAnswerBtn.style.display = 'none';
      refs.cancelAnswerBtn.setAttribute('aria-hidden', 'true');
      refs.cancelAnswerBtn.tabIndex = -1;
    }

    questionLayoutReady = true;
  }

  function clearQuestionTimerInterval() {
    if (questionTimerInterval) {
      clearInterval(questionTimerInterval);
      questionTimerInterval = null;
    }
  }

  function renderQuestionTimer() {
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

  function beginQuestionTimer(submitAnswer, remainingMs) {
    questionRemainingMs = Math.max(0, remainingMs);
    questionDeadlineTs = Date.now() + questionRemainingMs;
    renderQuestionTimer();

    clearQuestionTimerInterval();
    questionTimerInterval = setInterval(() => {
      const remainingMsNow = questionDeadlineTs - Date.now();

      if (remainingMsNow <= 0) {
        stopQuestionTimer();
        submitAnswer();
        return;
      }

      renderQuestionTimer();
    }, 250);
  }

  function stopQuestionTimer() {
    clearQuestionTimerInterval();
    questionDeadlineTs = 0;
    questionRemainingMs = 0;

    const el = document.getElementById('questionTimer');
    if (el) {
      el.textContent = '';
      el.classList.remove('show');
    }
  }

  function pauseQuestionTimer() {
    if (!questionDeadlineTs) return;
    questionRemainingMs = Math.max(0, questionDeadlineTs - Date.now());
    clearQuestionTimerInterval();
    questionDeadlineTs = 0;
  }

  function resumeQuestionTimer(submitAnswer) {
    if (!questionRemainingMs) return;
    if (loadSettings().difficulty !== 'hard') return;
    if (refs.questionModal.classList.contains('hidden')) return;

    beginQuestionTimer(submitAnswer, questionRemainingMs);
  }

  function startQuestionTimerIfNeeded(submitAnswer) {
    stopQuestionTimer();

    if (loadSettings().difficulty !== 'hard') return;
    if (refs.questionModal.classList.contains('hidden')) return;

    beginQuestionTimer(submitAnswer, constants.HARD_MODE_ANSWER_MS);
  }

  function showBanner(text) {
    if (!refs.banner) return;

    refs.banner.textContent = text;
    refs.banner.classList.add('show');

    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      refs.banner.classList.remove('show');
      refs.banner.textContent = '';
    }, constants.BANNER_MS);
  }

  function updateRunStats() {
    if (!state.run) return;

    if (refs.haulValueEl) refs.haulValueEl.textContent = formatMoney(state.run.haul);
    if (refs.strikesValueEl) refs.strikesValueEl.textContent = `${state.run.strikes} / 3`;

    if (refs.paintingsLeftValueEl) {
      const left = state.run.items.filter((item) => item.status === 'available').length;
      refs.paintingsLeftValueEl.textContent = String(left);
    }
  }

  function updateHubSave() {
    window.dispatchEvent(new CustomEvent('nanaheist:data-updated'));
  }

  function isConfirmPopupOpen() {
    return state.confirm.open;
  }

  function applyQuestionViewportVars() {
    if (!refs.questionModal) return;
    ensureQuestionLayoutStructure();

    const vv = window.visualViewport;
    const height = vv ? vv.height : window.innerHeight;
    const offsetTop = vv ? vv.offsetTop : 0;

    refs.questionModal.style.setProperty('--question-visible-height', `${height}px`);
    refs.questionModal.style.setProperty('--question-offset-top', `${offsetTop}px`);
  }

  function resetQuestionViewportVars() {
    if (!refs.questionModal) return;

    refs.questionModal.style.removeProperty('--question-visible-height');
    refs.questionModal.style.removeProperty('--question-offset-top');
  }

  function syncQuestionModalLayout() {
    if (!refs.questionModal) return;

    ensureQuestionLayoutStructure();

    const mobileLayout =
      !refs.questionModal.classList.contains('hidden') &&
      shouldUseMobileQuestionLayout();

    refs.questionModal.classList.toggle('native-mobile-input', mobileLayout);

    if (mobileLayout) {
      applyQuestionViewportVars();
    } else {
      resetQuestionViewportVars();
    }
  }

  function refreshQuestionInputView(delay = 0) {
    setTimeout(() => {
      if (refs.questionModal.classList.contains('hidden')) return;
      syncQuestionModalLayout();
    }, delay);
  }

  function activateQuestionInput() {
    if (refs.questionModal.classList.contains('hidden')) return;

    ensureQuestionLayoutStructure();
    syncQuestionModalLayout();

    requestAnimationFrame(() => {
      refs.questionModal.classList.add('keyboard-hack-active');

      try {
        refs.answerInput.focus({ preventScroll: true });
      } catch (_) {
        refs.answerInput.focus();
      }

      setTimeout(() => {
        syncQuestionModalLayout();
        refs.answerInput.scrollIntoView({ block: 'center', inline: 'nearest' });
      }, 120);

      setTimeout(() => {
        syncQuestionModalLayout();
        refs.answerInput.scrollIntoView({ block: 'center', inline: 'nearest' });
      }, 350);
    });
  }

  function closeQuestionModal() {
    refs.questionModal.classList.add('hidden');
    refs.questionModal.classList.remove('native-mobile-input');
    refs.questionModal.classList.remove('keyboard-hack-active');
    state.activeItem = null;
    stopQuestionTimer();
    refs.answerInput.blur();
    resetQuestionViewportVars();
  }

  function openConfirmPopup({ title, text, onConfirm, onCancel }) {
    state.confirm.open = true;
    state.confirm.onConfirm = onConfirm || null;
    state.confirm.onCancel = onCancel || null;

    refs.confirmChoiceTitle.textContent = title;
    refs.confirmChoiceText.textContent = text;
    refs.confirmChoiceOverlay.classList.remove('hidden');
  }

  function closeConfirmPopup() {
    refs.confirmChoiceOverlay.classList.add('hidden');
    state.confirm.open = false;
    state.confirm.onConfirm = null;
    state.confirm.onCancel = null;
  }

  function maybeShowHomeworkPopup() {
    if (!state.homework.pending.length || state.screen !== 'hub') return;

    if (refs.homeworkTitle) {
      refs.homeworkTitle.textContent = 'Heist Review';
    }

    if (refs.homeworkSub) {
      refs.homeworkSub.textContent =
        REVIEW_TAGLINES[Math.floor(Math.random() * REVIEW_TAGLINES.length)];
    }

    if (!refs.homeworkList) return;

    refs.homeworkList.innerHTML = '';

    state.homework.pending.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'homework-item';
      item.innerHTML = `
        <div class="homework-question">${entry.question}</div>
        <div class="homework-answer">Answer: ${entry.answer}</div>
      `;
      refs.homeworkList.appendChild(item);
    });

    refs.homeworkOverlay.classList.remove('hidden');
  }

  function hideHomeworkPopup() {
    refs.homeworkOverlay.classList.add('hidden');
    state.homework.pending = [];
    clearLastHeistWrong();
  }

  ensureQuestionLayoutStructure();

  refs.answerInput.setAttribute('autocomplete', 'off');
  refs.answerInput.setAttribute('autocapitalize', 'off');
  refs.answerInput.setAttribute('autocorrect', 'off');
  refs.answerInput.setAttribute('spellcheck', 'false');
  refs.answerInput.setAttribute('enterkeyhint', 'done');

  refs.answerInput.addEventListener('focus', () => {
    refreshQuestionInputView();
    refreshQuestionInputView(250);
    refreshQuestionInputView(500);
  });

  window.addEventListener('orientationchange', () => {
    refreshQuestionInputView(120);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      refreshQuestionInputView();
    });

    window.visualViewport.addEventListener('scroll', () => {
      refreshQuestionInputView();
    });
  }

  return {
    getQuestionTimerEl,
    stopQuestionTimer,
    pauseQuestionTimer,
    resumeQuestionTimer,
    startQuestionTimerIfNeeded,
    showBanner,
    updateRunStats,
    updateHubSave,
    isConfirmPopupOpen,
    activateQuestionInput,
    closeQuestionModal,
    openConfirmPopup,
    closeConfirmPopup,
    maybeShowHomeworkPopup,
    hideHomeworkPopup
  };
}
