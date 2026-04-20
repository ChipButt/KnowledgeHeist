import {
  appendHistoryEntry,
  saveLastHeistWrong,
  saveProgress
} from './storage.js';
import { chooseQuestionForItem, isAnswerCorrect } from './questionLogic.js';
import {
  getItemInteractPoint,
  getItemInteractRadius,
  getItemInteractZone,
  distance,
  getZoneCenter
} from './items.js';
import { pointInRect } from './zones.js';
import { createFailVoiceAudio, safeRestartAudio, stopAudio } from './audio.js';

export function formatMoney(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

export function shuffle(arr) {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

export function markQuestionUsed(state, questionId) {
  if (!questionId) return;

  if (!state.save.usedQuestionIds.includes(questionId)) {
    state.save.usedQuestionIds.push(questionId);
    saveProgress(state.save);
  }
}

export function recordWrongQuestion(state, questionObj) {
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

export function playRandomFailVoice(state, assets) {
  if (!state.run) return;

  if (!state.run.failVoicePool || state.run.failVoicePool.length === 0) {
    state.run.failVoicePool = shuffle([...assets.failVoiceFiles]);
  }

  const file = state.run.failVoicePool.shift();
  const audio = createFailVoiceAudio(file);
  const p = audio.play();
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

export function stopAllGameAudio(assets) {
  stopAudio(assets.backgroundMusic);
  stopAudio(assets.sirenSound);
  stopAudio(assets.withMeSound);
  stopAudio(assets.heyStopSound);
  stopAudio(assets.chaChingSound);
}

export function playHeyStopThenSiren(state, assets) {
  state.audio.sirenStarted = false;

  const startSiren = () => {
    if (state.audio.sirenStarted) return;
    state.audio.sirenStarted = true;
    safeRestartAudio(assets.sirenSound, assets.sirenSound.volume);
  };

  try {
    assets.heyStopSound.pause();
    assets.heyStopSound.currentTime = 0;
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
      ['chase', 'escort', 'escort_wait'].includes(state.run.mode)
    ) {
      startSiren();
    }
  }, 1200);
}

export function playWithMe(state, assets) {
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

export function flashWrong(state, constants) {
  state.fx.wrongFlashTimer = constants.WRONG_FLASH_MS;
  state.fx.shakeTimer = constants.SHAKE_MS;
}

export function updateFX(state, delta) {
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

export function getPlayerInteractPoint(
  state,
  playerDrawH,
  playerDrawYOffset,
  playerFeetPointY
) {
  const drawTopY = state.player.y - playerDrawH - playerDrawYOffset;

  return {
    x: state.player.x,
    y: drawTopY + (playerDrawH * playerFeetPointY)
  };
}

export function getNearbyItem({ state, run, sx, sy, getPlayerInteractPointFn }) {
  if (!run || run.mode !== 'play') return null;

  const playerPoint = getPlayerInteractPointFn();
  let nearest = null;
  let nearestDist = Infinity;

  for (const item of run.items) {
    if (item.status !== 'available') continue;

    const zone = getItemInteractZone(item, sx, sy);

    if (zone) {
      if (!pointInRect(playerPoint.x, playerPoint.y, zone)) continue;

      const center = getZoneCenter(zone);
      const d = distance(playerPoint.x, playerPoint.y, center.x, center.y);

      if (d < nearestDist) {
        nearest = item;
        nearestDist = d;
      }

      continue;
    }

    const itemPoint = getItemInteractPoint(item, sx, sy);
    const allowedDist = getItemInteractRadius(item, sx, sy);
    const d = distance(playerPoint.x, playerPoint.y, itemPoint.x, itemPoint.y);

    if (d <= allowedDist && d < nearestDist) {
      nearest = item;
      nearestDist = d;
    }
  }

  return nearest;
}

export function getPullDirectionForItem(item, state) {
  if (item.type === 'wall') return item.wall;

  const dx = item.anchorX - state.player.x;
  if (dx > 22) return 'east';
  if (dx < -22) return 'west';
  return 'north';
}

export function startPullAnimation(state, item) {
  const pullDir = getPullDirectionForItem(item, state);

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

export function finishSuccessfulPull(
  state,
  assets,
  updateRunStats,
  showBanner
) {
  const action = state.player.action;
  if (!action || action.type !== 'pull') return;

  const item = action.item;
  const q = item.question;

  item.status = 'stolen';
  state.run.haul += Number(q.value || 0);

  updateRunStats();
  showBanner(`Stolen! +${formatMoney(Number(q.value || 0))}`);
  safeRestartAudio(assets.chaChingSound, assets.chaChingSound.volume);

  state.player.action = null;
  state.player.controlLocked = false;
  state.run.mode = 'play';

  if (state.run.items.every((entry) => entry.status !== 'available')) {
    showBanner('All items attempted. Head for the exit.');
  }
}

export function updatePullAnimation(
  state,
  delta,
  constants,
  assets,
  updateRunStats,
  showBanner
) {
  const action = state.player.action;
  if (!action || action.type !== 'pull') return;

  action.timer += delta;

  if (action.timer >= constants.PULL_FRAME_MS) {
    action.timer = 0;
    action.frameIndex += 1;

    if (action.frameIndex >= 6) {
      finishSuccessfulPull(state, assets, updateRunStats, showBanner);
    }
  }
}

export function triggerGuardChase(state, assets, constants, showBanner) {
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

  playHeyStopThenSiren(state, assets);
  showBanner('Security is coming...');
}

export function triggerHeistEndHomework(state) {
  state.homework.pending = state.run?.wrongQuestions ? [...state.run.wrongQuestions] : [];
  saveLastHeistWrong(state.homework.pending);
}

export function submitAnswer({
  state,
  input,
  closeQuestionModal,
  constants,
  assets,
  updateRunStats,
  showBanner
}) {
  if (!state.activeItem) return;

  const item = state.activeItem;
  const q = item.question;

  if (!q) {
    closeQuestionModal();
    return;
  }

  closeQuestionModal();
  markQuestionUsed(state, q.id);

  if (isAnswerCorrect(input, q)) {
    startPullAnimation(state, item);
  } else {
    item.status = 'failed';
    state.run.strikes += 1;
    recordWrongQuestion(state, q);
    updateRunStats();
    flashWrong(state, constants);
    playRandomFailVoice(state, assets);
    showBanner('Wrong answer. Security alert increased.');

    if (state.run.strikes >= 3) {
      triggerGuardChase(state, assets, constants, showBanner);
    }
  }

  state.activeItem = null;
}

export function askQuestionForItem({
  state,
  questionTextEl,
  answerInput,
  questionModal,
  showBanner
}) {
  const item = state.activeItem;
  if (!item) return false;

  const q = chooseQuestionForItem(item, state.save.usedQuestionIds, shuffle);
  if (!q) {
    showBanner('No unused questions left for this difficulty.');
    state.activeItem = null;
    return false;
  }

  questionTextEl.textContent = `${q.question} (${formatMoney(Number(q.value || 0))})`;
  answerInput.value = '';
  questionModal.classList.remove('hidden');

  setTimeout(() => {
    try {
      answerInput.focus({ preventScroll: true });
    } catch (_) {
      answerInput.focus();
    }
  }, 0);

  return true;
}

export function endHeist({
  state,
  escaped,
  showScreen,
  maybeShowHomeworkPopup,
  showBanner,
  closeQuestionModal,
  closeConfirmPopup,
  resetMovementKeys,
  resetPointerInput,
  summaryOverlay,
  updateHubSave
}) {
  if (!state.run || state.run.ended) return;

  state.run.ended = true;
  triggerHeistEndHomework(state);

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

    closeQuestionModal();
    closeConfirmPopup();
    resetMovementKeys();
    resetPointerInput();

    const finalHaul = state.run.haul;

    state.run = null;
    state.activeItem = null;
    state.player.action = null;

    if (summaryOverlay) summaryOverlay.classList.add('hidden');
    showScreen('hub');
    if (typeof updateHubSave === 'function') updateHubSave();
    maybeShowHomeworkPopup();
    showBanner(`Heist complete. Banked ${formatMoney(finalHaul)}.`);
    return;
  }

  state.save.heistsPlayed += 1;
  saveProgress(state.save);
  appendHistoryEntry({
    heistNumber: state.save.heistsPlayed,
    success: false
  });
}
