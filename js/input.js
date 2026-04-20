export function isMobileLike() {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.innerWidth < 900
  );
}

export function getMoveSpeed(constants) {
  return isMobileLike() ? constants.MOVE_SPEED_MOBILE : constants.MOVE_SPEED_DESKTOP;
}

export function resetMovementKeys(state) {
  state.keys.up = false;
  state.keys.down = false;
  state.keys.left = false;
  state.keys.right = false;
}

export function resetPointerInput(state) {
  state.pointer.active = false;
  state.pointer.pointerId = null;
  state.pointer.startX = 0;
  state.pointer.startY = 0;
  state.pointer.currentX = 0;
  state.pointer.currentY = 0;
  state.pointer.dragX = 0;
  state.pointer.dragY = 0;
}

export function hasKeyboardInput(state) {
  return state.keys.up || state.keys.down || state.keys.left || state.keys.right;
}

export function normalizeVector(dx, dy, speed) {
  const len = Math.hypot(dx, dy);
  if (!len) return { dx: 0, dy: 0 };

  return {
    dx: (dx / len) * speed,
    dy: (dy / len) * speed
  };
}

export function getCanvasPointFromEvent(canvas, e, viewW, viewH) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * viewW,
    y: ((e.clientY - rect.top) / rect.height) * viewH
  };
}

export function startPointerControl({
  state,
  canvas,
  e,
  viewW,
  viewH,
  questionModalOpen,
  confirmOpen
}) {
  if (state.screen !== 'game') return;
  if (!state.run || state.run.ended) return;
  if (questionModalOpen) return;
  if (confirmOpen) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  const point = getCanvasPointFromEvent(canvas, e, viewW, viewH);

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

export function updatePointerControl({
  state,
  e,
  canvas,
  viewW,
  viewH,
  deadzoneRadius
}) {
  if (!state.pointer.active) return;
  if (state.pointer.pointerId !== e.pointerId) return;

  const point = getCanvasPointFromEvent(canvas, e, viewW, viewH);
  state.pointer.currentX = point.x;
  state.pointer.currentY = point.y;

  const rawDx = state.pointer.currentX - state.pointer.startX;
  const rawDy = state.pointer.currentY - state.pointer.startY;
  const len = Math.hypot(rawDx, rawDy);

  if (len < deadzoneRadius) {
    state.pointer.dragX = 0;
    state.pointer.dragY = 0;
    return;
  }

  state.pointer.dragX = rawDx / len;
  state.pointer.dragY = rawDy / len;
}

export function endPointerControl(state, e = null) {
  if (!state.pointer.active) return;
  if (e && state.pointer.pointerId !== null && e.pointerId !== state.pointer.pointerId) return;
  resetPointerInput(state);
}

export function getDirectionalInput(state, speed) {
  let dx = 0;
  let dy = 0;

  if (hasKeyboardInput(state)) {
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

export async function requestGameFullscreen(target) {
  if (!isMobileLike()) return;
  if (document.fullscreenElement) return;
  if (!target) return;

  try {
    if (typeof target.requestFullscreen === 'function') {
      await target.requestFullscreen();
    }
  } catch (_) {}
}
