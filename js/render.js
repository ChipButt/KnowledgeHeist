function imageReady(img) {
  return !!img && img.complete && img.naturalWidth > 0;
}

function drawImageFit(ctx, img, x, y, w, h) {
  if (!imageReady(img)) return;

  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;

  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawFallbackRoom(ctx, canvas) {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#d8d8de');
  g.addColorStop(0.55, '#ded6cf');
  g.addColorStop(1, '#cfc6be');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(
    canvas.width * 0.22,
    canvas.height * 0.1,
    canvas.width * 0.56,
    canvas.height * 0.35
  );

  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);
}

function drawExitMat(ctx, exit) {
  const matX = exit.x1 + 8;
  const matY = exit.y1 + 14;
  const matW = exit.x2 - exit.x1 - 16;
  const matH = 28;

  ctx.save();
  ctx.fillStyle = 'rgba(42,45,50,0.72)';
  ctx.fillRect(matX, matY, matW, matH);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(matX, matY, matW, matH);
  ctx.fillStyle = '#e9dfc8';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', matX + matW / 2, matY + matH / 2 + 1);
  ctx.restore();
}

function resolveItemImage(item) {
  return item.image || null;
}

function drawWallItem(ctx, item) {
  const img = resolveItemImage(item);
  if (!img) return;

  if (item.status === 'failed') {
    ctx.save();
    ctx.filter = 'grayscale(100%) brightness(0.65)';
    drawImageFit(ctx, img, item.x, item.y, item.w, item.h);
    ctx.restore();
    return;
  }

  drawImageFit(ctx, img, item.x, item.y, item.w, item.h);
}

function drawFloorItem(ctx, item) {
  const drawX = item.anchorX - item.drawW / 2;
  const drawY = item.anchorY - item.drawH;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(
    item.anchorX,
    item.anchorY - 4,
    item.drawW * 0.32,
    item.drawH * 0.08,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  const img = resolveItemImage(item);
  if (!imageReady(img)) return;

  if (item.status === 'failed') {
    ctx.save();
    ctx.filter = 'grayscale(100%) brightness(0.65)';
    ctx.drawImage(img, drawX, drawY, item.drawW, item.drawH);
    ctx.restore();
    return;
  }

  ctx.drawImage(img, drawX, drawY, item.drawW, item.drawH);
}

function getCurrentPlayerImage(player, assets) {
  if (player.action && player.action.type === 'pull') {
    const set = assets.pullAnimations[player.action.dir] || assets.pullAnimations.north;
    return set[Math.min(player.action.frameIndex, set.length - 1)];
  }

  const set = assets.walkAnimations[player.direction] || assets.walkAnimations.south;
  return set[player.walkFrameIndex];
}

function drawFallbackPlayer(ctx, player) {
  const drawX = player.x - 50;
  const drawY = player.y - 100;

  ctx.fillStyle = '#f3d082';
  ctx.fillRect(drawX + 34, drawY + 14, 32, 72);
  ctx.fillStyle = '#222';
  ctx.fillRect(drawX + 44, drawY + 28, 6, 6);
  ctx.fillRect(drawX + 56, drawY + 28, 6, 6);
}

function drawPlayer(ctx, player, assets) {
  if (!player.visible) return;

  const drawX = player.x - 50;
  const drawY = player.y - 100;
  const img = getCurrentPlayerImage(player, assets);

  if (imageReady(img)) {
    ctx.drawImage(img, drawX, drawY, 100, 100);
  } else {
    drawFallbackPlayer(ctx, player);
  }
}

function getCurrentGuardImage(guard, assets) {
  if (guard.mode === 'walk') {
    const dir =
      guard.direction === 'south-east' ||
      guard.direction === 'south-west' ||
      guard.direction === 'south'
        ? guard.direction
        : 'south';

    const set = assets.guardWalkAnimations[dir] || assets.guardWalkAnimations.south;
    const frame = set[guard.frameIndex % set.length];
    return imageReady(frame) ? frame : null;
  }

  const runSet = assets.guardRunAnimations[guard.direction] || assets.guardRunAnimations.south;
  const runFrame = runSet[guard.frameIndex % runSet.length];
  return imageReady(runFrame) ? runFrame : null;
}

function drawFallbackGuard(ctx, guard) {
  const drawX = guard.x - 50;
  const drawY = guard.y - 100;
  ctx.fillStyle = '#6b8cff';
  ctx.fillRect(drawX + 32, drawY + 12, 34, 76);
}

function drawGuard(ctx, guard, assets) {
  if (!guard.active || !guard.visible) return;

  const drawX = guard.x - 50;
  const drawY = guard.y - 100;
  const img = getCurrentGuardImage(guard, assets);

  if (img) {
    ctx.drawImage(img, drawX, drawY, 100, 100);
  } else {
    drawFallbackGuard(ctx, guard);
  }
}

function drawPrompt(ctx, state, helpers) {
  if (!state.run || state.run.mode !== 'play' || state.player.controlLocked) return;

  const item = helpers.getNearbyItem();
  if (item) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(state.player.x - 70, state.player.y - 124, 140, 20);
    ctx.fillStyle = '#f7e7b0';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Attempt to grab', state.player.x, state.player.y - 114);
    return;
  }

  const exit = helpers.getExitZone();
  if (helpers.pointInRect(state.player.x, state.player.y, exit)) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(state.player.x - 30, state.player.y - 124, 60, 20);
    ctx.fillStyle = '#f7e7b0';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Exit', state.player.x, state.player.y - 114);
  }
}

export function drawRoom(runtime) {
  const { canvas, ctx, state, assets, helpers, constants } = runtime;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(state.fx.shakeX, state.fx.shakeY);

  if (imageReady(assets.roomBackground)) {
    ctx.drawImage(assets.roomBackground, 0, 0, canvas.width, canvas.height);
  } else {
    drawFallbackRoom(ctx, canvas);
  }

  drawExitMat(ctx, helpers.getExitZone());

  if (state.run) {
    const wallItems = state.run.items.filter(
      (item) => item.type === 'wall' && item.status !== 'stolen'
    );
    const floorItems = state.run.items.filter(
      (item) => item.type === 'floor' && item.status !== 'stolen'
    );

    wallItems.forEach((item) => drawWallItem(ctx, item));

    const drawables = [];

    floorItems.forEach((item) => {
      drawables.push({
        y: item.anchorY,
        draw: () => drawFloorItem(ctx, item)
      });
    });

    if (state.player.visible) {
      drawables.push({
        y: state.player.y,
        draw: () => drawPlayer(ctx, state.player, assets)
      });
    }

    if (state.guard.active && state.guard.visible) {
      drawables.push({
        y: state.guard.y,
        draw: () => drawGuard(ctx, state.guard, assets)
      });
    }

    drawables.sort((a, b) => a.y - b.y).forEach((entry) => entry.draw());
  }

  drawPrompt(ctx, state, helpers);
  ctx.restore();

  if (state.fx.wrongFlashTimer > 0) {
    const alpha = (state.fx.wrongFlashTimer / constants.WRONG_FLASH_MS) * 0.22;
    ctx.fillStyle = `rgba(255,0,0,${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const showGuardFlash =
    state.fx.guardFlashTimer > 0 ||
    (
      state.run &&
      (
        state.run.mode === 'chase' ||
        state.run.mode === 'escort' ||
        state.run.mode === 'escort_wait'
      )
    );

  if (showGuardFlash) {
    const pulse = Math.floor(performance.now() / 120) % 2;
    ctx.fillStyle =
      pulse === 0 ? 'rgba(255,0,0,0.10)' : 'rgba(0,100,255,0.10)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
