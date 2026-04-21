import { clearLastHeistWrong, loadSettings } from './storage.js';
import { formatMoney } from './gameFlow.js';
import { REVIEW_TAGLINES } from './gameConfig.js';

const QUESTION_KEY_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '-', '.', ':'],
  ['SPACE', '%', 'BACK', 'CLEAR']
];

function shouldUseBuiltInKeyboard() {
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
  let questionKeyboardEl = null;

  function getQuestionTimerEl() {
    let el = document.getElementById('questionTimer');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'questionTimer';
    el.className = 'question-timer';
    refs.questionTextEl.insertAdjacentElement('afterend', el);
    return el;
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

  function ensureQuestionKeyboard() {
    if (questionKeyboardEl) return questionKeyboardEl;

    const modalCard = refs.questionModal?.querySelector('.modal-card');
    if (!modalCard) return null;

    const keyboard = document.createElement('div');
    keyboard.id = 'questionKeyboard';
    keyboard.className = 'question-keyboard';

    QUESTION_KEY_ROWS.forEach((rowKeys) => {
      const row = document.createElement('div');
      row.className = 'question-keyboard-row';
      row.style.gridTemplateColumns = `repeat(${rowKeys.length}, minmax(0, 1fr))`;

      rowKeys.forEach((key) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'question-key';
        btn.dataset.key = key;
        btn.textContent =
          key === 'SPACE' ? 'Space' :
          key === 'BACK' ? '⌫' :
          key === 'CLEAR' ? 'Clear' :
          key;

        if (key === 'SPACE') btn.classList.add('wide');
        if (key === 'BACK' || key === 'CLEAR') btn.classList.add('action');

        row.appendChild(btn);
      });

      keyboard.appendChild(row);
    });

    keyboard.addEventListener('click', (e) => {
      const button = e.target.closest('.question-key');
      if (!button) return;

      const key = button.dataset.key;
      if (!key) return;

      if (key === 'BACK') {
        refs.answerInput.value = refs.answerInput.value.slice(0, -1);
        return;
      }

      if (key === 'CLEAR') {
        refs.answerInput.value = '';
        return;
      }

      if (key === 'SPACE') {
        refs.answerInput.value += ' ';
        return;
      }

      refs.answerInput.value += key;
    });

    const actions = modalCard.querySelector('.modal-actions');
    if (actions) {
      modalCard.insertBefore(keyboard, actions);
    } else {
      modalCard.appendChild(keyboard);
    }

    questionKeyboardEl = keyboard;
    return keyboard;
  }

  function setQuestionKeyboardVisible(visible) {
    const keyboard = ensureQuestionKeyboard();
    if (!keyboard) return;

    keyboard.classList.toggle('show', visible);
    refs.questionModal.classList.toggle('with-built-in-keyboard', visible);
  }

  function configureQuestionInputMode() {
    const builtIn = shouldUseBuiltInKeyboard();

    if (builtIn) {
      refs.answerInput.readOnly = true;
      refs.answerInput.setAttribute('readonly', 'readonly');
      refs.answerInput.setAttribute('inputmode', 'none');
      refs.answerInput.blur();
      setQuestionKeyboardVisible(true);
      return true;
    }

    refs.answerInput.readOnly = false;
    refs.answerInput.removeAttribute('readonly');
    refs.answerInput.setAttribute('inputmode', 'text');
    setQuestionKeyboardVisible(false);
    return false;
  }

  function activateQuestionInput() {
    const usingBuiltInKeyboard = configureQuestionInputMode();

    if (!usingBuiltInKeyboard) {
      setTimeout(() => {
        try {
          refs.answerInput.focus({ preventScroll: true });
        } catch (_) {
          refs.answerInput.focus();
        }
      }, 0);
    }
  }

  function closeQuestionModal() {
    refs.questionModal.classList.add('hidden');
    refs.questionModal.classList.remove('with-built-in-keyboard');
    state.activeItem = null;
    stopQuestionTimer();
    refs.answerInput.blur();
    setQuestionKeyboardVisible(false);
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

  window.addEventListener('resize', () => {
    if (!refs.questionModal.classList.contains('hidden')) {
      configureQuestionInputMode();
    }
  });

  window.addEventListener('orientationchange', () => {
    if (!refs.questionModal.classList.contains('hidden')) {
      setTimeout(() => {
        configureQuestionInputMode();
      }, 100);
    }
  });

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
