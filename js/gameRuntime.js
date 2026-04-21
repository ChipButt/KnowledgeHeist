import { drawRoom, getPromptBounds } from './render.js';
import { drawInteractionDebug, drawLayoutOverlay } from './debug.js';
import {
  getExitZone,
  getFloorPoly,
  getGuardDoorZone,
  pointInPolygon,
  pointInRect
} from './zones.js';
import {
  buildScaledRunData,
  getItemInteractPoint,
  getItemInteractRadius,
  getItemInteractZone,
  pointHitsFloorBlocker
} from './items.js';
import {
  askQuestionForItem,
  getNearbyItem,
  getPlayerInteractPoint,
  playWithMe,
  submitAnswer as submitAnswerFlow,
  updateFX,
  updatePullAnimation
} from './gameFlow.js';
import { getDirectionalInput, getMoveSpeed } from './input.js';

export function createGameRuntime(context, deps) {
  const { canvas, ctx, state, assets, constants, refs, sx, sy, view } = context;
  const { ui } = deps;

  function getSession() {
    return deps.session || null;
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
      sy(constants.PLAYER_DRAW_H_SOURCE),
      sy(constants.PLAYER_DRAW_Y_OFFSET_SOURCE),
      constants.PLAYER_FEET_POINT_Y
    );
  }

  function getPlayerFeetPointForPosition(x, y) {
    const drawTopY = y - sy(constants.PLAYER_DRAW_H_SOURCE) - sy(constants.PLAYER_DRAW_Y_OFFSET_SOURCE);

    return {
      x,
      y: drawTopY + (sy(constants.PLAYER_DRAW_H_SOURCE) * constants.PLAYER_FEET_POINT_Y)
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

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    canvas.width = width;
    canvas.height = height;

    view.width = width;
    view.height = height;

    if (state.run) {
      buildScaledRunData(state.run, sx, sy);
    }
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

  function canOccupyFeetPoint(x, y, options = {}) {
    if (!pointInPolygon({ x, y }, getFloorPolyNow())) return false;

    if (
      !options.ignoreBlockers &&
      state.run &&
      pointHitsFloorBlocker(state.run.items, x, y, options)
    ) {
      return false;
    }

    return true;
  }

  function tryMoveAxis(dx, dy, options = {}) {
    if (dx === 0 && dy === 0) return false;

    const nextX = state.player.x + dx;
    const nextY = state.player.y + dy;
    const nextFeet = getPlayerFeetPointForPosition(nextX, nextY);

    if (!canOccupyFeetPoint(nextFeet.x, nextFeet.y, options)) return false;

    state.player.x = nextX;
    state.player.y = nextY;
    return true;
  }

  function tryMove(dx, dy, options = {}) {
    let moved = false;

    if (dx !== 0) {
      moved = tryMoveAxis(dx, 0, options) || moved;
    }

    if (dy !== 0) {
      moved = tryMoveAxis(0, dy, options) || moved;
    }

    return moved;
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

  function updateExitZoneTrigger() {
    if (!state.run || state.run.ended) return;
    if (state.run.mode !== 'play') return;
    if (ui.isConfirmPopupOpen()) return;

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
      getSession()?.handleEscapeRequest?.();
    }

    state.run.wasInExitZone = isInExitZone;
  }

  function interact() {
    if (getSession()?.isPortraitBlocked()) return;
    if (!state.run || state.run.ended) return;
    if (state.player.controlLocked || state.player.action) return;
    if (ui.isConfirmPopupOpen()) return;
    if (state.run.mode !== 'play') return;

    const item = getNearbyItem({
      state,
      run: state.run,
      sx,
      sy,
      getPlayerInteractPointFn: getPlayerFeetPoint
    });

    if (!item) {
      ui.showBanner('Nothing to interact with here.');
      return;
    }

    state.activeItem = item;
    const opened = askQuestionForItem({
      state,
      questionTextEl: refs.questionTextEl,
      answerInput: refs.answerInput,
      questionModal: refs.questionModal,
      showBanner: ui.showBanner
    });

    if (opened) {
      ui.activateQuestionInput();
      ui.startQuestionTimerIfNeeded(submitAnswer);
    }

    state.pointer.active = false;
    state.pointer.pointerId = null;
    state.pointer.startX = 0;
    state.pointer.startY = 0;
    state.pointer.currentX = 0;
    state.pointer.currentY = 0;
    state.pointer.dragX = 0;
    state.pointer.dragY = 0;

    window.scrollTo(0, 0);
  }

  function submitAnswer() {
    if (getSession()?.isPortraitBlocked()) return;

    ui.stopQuestionTimer();

    submitAnswerFlow({
      state,
      input: refs.answerInput.value,
      closeQuestionModal: ui.closeQuestionModal,
      constants,
      assets,
      updateRunStats: ui.updateRunStats,
      showBanner: ui.showBanner
    });
  }

  function update(delta) {
    updateFX(state, delta);

    if (getSession()?.isPortraitBlocked()) return;
    if (state.screen !== 'game' || !state.run || state.run.ended) return;
    if (!refs.questionModal.classList.contains('hidden') && state.run.mode === 'play') return;
    if (ui.isConfirmPopupOpen()) return;

    state.player.moving = false;
    state.guard.moving = false;

    if (state.run.mode === 'play') {
      const move = getDirectionalInput(state, getMoveSpeed(constants));

      if (move.dx !== 0 || move.dy !== 0) {
        state.player.direction = vectorToDirection(move.dx, move.dy);
        state.player.moving = tryMove(move.dx, move.dy);
      }

      updateExitZoneTrigger();
      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'pull') {
      updatePullAnimation(state, delta, constants, assets, ui.updateRunStats, ui.showBanner);
      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'guard_intro') {
      state.player.controlLocked = true;
      state.player.moving = false;
      state.guard.active = false;
      state.guard.visible = false;
      state.guard.moving = false;

      state.run.guardIntroRemainingMs = Math.max(
        0,
        (state.run.guardIntroRemainingMs || 0) - delta
      );

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);

      if (state.run.guardIntroRemainingMs <= 0) {
        state.guard.active = true;
        state.guard.visible = true;
        state.guard.mode = 'run';
        state.guard.frameIndex = 0;
        state.guard.frameTimer = 0;
        state.guard.moving = true;

        state.player.controlLocked = false;
        state.run.mode = 'chase';

        playWithMe(state, assets);
        ui.showBanner('Run!');
      }

      return;
    }

    if (state.run.mode === 'chase') {
      const move = getDirectionalInput(state, constants.CHASE_PLAYER_SPEED);

      if (move.dx !== 0 || move.dy !== 0) {
        state.player.direction = vectorToDirection(move.dx, move.dy);
        state.player.moving = tryMove(move.dx, move.dy);
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
        ui.showBanner('Caught! Escorted out.');
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
        getSession()?.handleCaughtEscortComplete?.();
      }
    }
  }

  const runtime = {
    canvas,
    ctx,
    state,
    assets,
    constants,
    sx,
    sy,
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
        VIEW_W: view.width,
        VIEW_H: view.height,
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

  return {
    runtime,
    resizeCanvas,
    getGuardDoorCenter,
    getGuardDoorBottomY,
    getPromptBounds: () => runtime.helpers.getPromptBounds(),
    pointInSimpleRect,
    interact,
    submitAnswer,
    gameLoop
  };
}
