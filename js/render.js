const failedImageCache = new WeakMap();

function getDrawableWidth(img) {
  return img?.naturalWidth || img?.videoWidth || img?.width || 0;
}

function getDrawableHeight(img) {
  return img?.naturalHeight || img?.videoHeight || img?.height || 0;
}

function imageReady(img) {
  return !!img && getDrawableWidth(img) > 0 && getDrawableHeight(img) > 0 && (img.complete !== false);
}

function getPlayerDrawMetrics(runtime) {
  const { constants, sx, sy } = runtime;
  return {
    drawW: sx(constants.PLAYER_DRAW_W_SOURCE),
    drawH: sy(constants.PLAYER_DRAW_H_SOURCE),
    yOffset: sy(constants.PLAYER_DRAW_Y_OFFSET_SOURCE)
  };
}

function getGuardDrawMetrics(runtime) {
  const { constants, sx, sy } = runtime;
  return {
    drawW: sx(constants.GUARD_DRAW_W_SOURCE),
    drawH: sy(constants.GUARD_DRAW_H_SOURCE),
    yOffset: sy(constants.GUARD_DRAW_Y_OFFSET_SOURCE)
  };
}

function drawImageFit(ctx, img, x, y, w, h) {
  if (!imageReady(img)) return;

  const sourceW = getDrawableWidth(img);
  const sourceH = getDrawableHeight(img);
  const scale = Math.min(w / sourceW, h / sourceH);
  const dw = sourceW * scale;
  const dh = sourceH * scale;
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

function createFailedVariant(img) {
  if (!imageReady(img)) return img;

  const cached = failedImageCache.get(img);
  if (cached) return cached;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = getDrawableWidth(img);
    canvas.height = getDrawableHeight(img);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return img;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a === 0) continue;

      const gray = Math.round((r * 0.299 + g * 0.587 + b * 0.114) * 0.65);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    ctx.putImageData(imageData, 0, 0);
    failedImageCache.set(img, canvas);
    return canvas;
  } catch (_) {
    return img;
  }
}

function getDrawableItemImage(item) {
  const img = resolveItemImage(item);
  if (!img) return null;
  if (item.status !== 'failed') return img;
  return createFailedVariant(img);
}

function drawWallItem(ctx, item) {
  const img = getDrawableItemImage(item);
  if (!img) return;

  drawImageFit(ctx, img, item.x, item.y, item.w, item.h);
}

function getFloorItemDrawTopLeft(item) {
  return {
    drawX: item.anchorX - item.drawW / 2,
    drawY: item.anchorY - item.drawH
  };
}

function getFloorItemSplit(item) {
  const { drawX, drawY } = getFloorItemDrawTopLeft(item);
  const splitY = drawY + (item.drawH * 0.5);

  return {
    drawX,
    drawY,
    splitY,
    topH: splitY - drawY,
    bottomH: (drawY + item.drawH) - splitY
  };
}

function drawFloorShadow(ctx, item) {
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
}

function drawFloorItemSlice(ctx, item, slice) {
  const img = getDrawableItemImage(item);
  if (!imageReady(img)) return;

  const { drawX, drawY, topH, bottomH } = getFloorItemSplit(item);

  const sourceW = getDrawableWidth(img);
  const sourceH = getDrawableHeight(img);
  const sourceTopH = sourceH * 0.5;
  const sourceBottomH = sourceH - sourceTopH;

  if (slice === 'bottom') {
    ctx.drawImage(
      img,
      0,
      sourceTopH,
      sourceW,
      sourceBottomH,
      drawX,
      drawY + topH,
      item.drawW,
      bottomH
    );
    return;
  }

  ctx.drawImage(
    img,
    0,
    0,
    img.naturalWidth,
    sourceTopH,
    drawX,
    drawY,
    item.drawW,
    topH
  );
}

function drawFloorItemBase(ctx, item) {
  drawFloorShadow(ctx, item);
  drawFloorItemSlice(ctx, item, 'bottom');
}

function drawFloorItemOverlay(ctx, item) {
  drawFloorItemSlice(ctx, item, 'top');
}

function getCurrentPlayerImage(player, assets) {
  if (player.action && player.action.type === 'pull') {
    const set = assets.pullAnimations[player.action.dir] || assets.pullAnimations.north;
    return set[Math.min(player.action.frameIndex, set.length - 1)];
  }

  const set = assets.walkAnimations[player.direction] || assets.walkAnimations.south;
  return set[player.walkFrameIndex] || set[0];
}

function drawFallbackPlayer(ctx, player, metrics) {
  const drawX = player.x - metrics.drawW / 2;
  const drawY = player.y - metrics.drawH - metrics.yOffset;

  ctx.fillStyle = '#f3d082';
  ctx.fillRect(drawX + metrics.drawW * 0.34, drawY + metrics.drawH * 0.14, metrics.drawW * 0.32, metrics.drawH * 0.72);
  ctx.fillStyle = '#222';
  ctx.fillRect(drawX + metrics.drawW * 0.44, drawY + metrics.drawH * 0.28, metrics.drawW * 0.06, metrics.drawH * 0.06);
  ctx.fillRect(drawX + metrics.drawW * 0.56, drawY + metrics.drawH * 0.28, metrics.drawW * 0.06, metrics.drawH * 0.06);
}

function drawPlayer(ctx, player, assets, runtime) {
  if (!player.visible) return;

  const metrics = getPlayerDrawMetrics(runtime);
  const drawX = player.x - metrics.drawW / 2;
  const drawY = player.y - metrics.drawH - metrics.yOffset;
  const img = getCurrentPlayerImage(player, assets);

  if (imageReady(img)) {
    ctx.drawImage(img, drawX, drawY, metrics.drawW, metrics.drawH);
  } else {
    drawFallbackPlayer(ctx, player, metrics);
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
  const runFrame = runSet[guard.frameIndex % set.length];
  return imageReady(runFrame) ? runFrame : null;
}

function drawFallbackGuard(ctx, guard, metrics) {
  const drawX = guard.x - metrics.drawW / 2;
  const drawY = guard.y - metrics.drawH - metrics.yOffset;
  ctx.fillStyle = '#6b8cff';
  ctx.fillRect(drawX + metrics.drawW * 0.32, drawY + metrics.drawH * 0.12, metrics.drawW * 0.34, metrics.drawH * 0.76);
}

function drawGuard(ctx, guard, assets, runtime) {
  if (!guard.active || !guard.visible) return;

  const metrics = getGuardDrawMetrics(runtime);
  const drawX = guard.x - metrics.drawW / 2;
  const drawY = guard.y - metrics.drawH - metrics.yOffset;
  const img = getCurrentGuardImage(guard, assets);

  if (img) {
    ctx.drawImage(img, drawX, drawY, metrics.drawW, metrics.drawH);
  } else {
    drawFallbackGuard(ctx, guard, metrics);
  }
}

function getPromptBounds(runtime) {
  const { state, helpers } = runtime;
  if (!state.run || state.run.mode !== 'play' || state.player.controlLocked) return null;

  const item = helpers.getNearbyItem();
  if (!item) return null;

  const itemPoint = helpers.getItemInteractPoint(item);

  return {
    item,
    x: itemPoint.x - 42,
    y: itemPoint.y - 44,
    w: 84,
    h: 20,
    cx: itemPoint.x,
    cy: itemPoint.y - 34
  };
}

function drawPrompt(ctx, runtime) {
  const prompt = getPromptBounds(runtime);
  if (!prompt) return;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(prompt.x, prompt.y, prompt.w, prompt.h);
  ctx.fillStyle = '#f7e7b0';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GRAB', prompt.cx, prompt.cy);
  ctx.restore();
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
    const overlays = [];

    floorItems.forEach((item) => {
      drawables.push({
        y: item.anchorY,
        draw: () => drawFloorItemBase(ctx, item)
      });

      overlays.push({
        y: item.anchorY,
        draw: () => drawFloorItemOverlay(ctx, item)
      });
    });

    if (state.player.visible) {
      drawables.push({
        y: state.player.y,
        draw: () => drawPlayer(ctx, state.player, assets, runtime)
      });
    }

    if (state.guard.active && state.guard.visible) {
      drawables.push({
        y: state.guard.y,
        draw: () => drawGuard(ctx, state.guard, assets, runtime)
      });
    }

    drawables.sort((a, b) => a.y - b.y).forEach((entry) => entry.draw());
    overlays.sort((a, b) => a.y - b.y).forEach((entry) => entry.draw());
  }

  drawPrompt(ctx, runtime);
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
        state.run.mode === 'escort_wait' ||
        state.run.mode === 'guard_intro'
      )
    );

  if (showGuardFlash) {
    const pulse = Math.floor(performance.now() / 120) % 2;
    ctx.fillStyle =
      pulse === 0 ? 'rgba(255,0,0,0.10)' : 'rgba(0,100,255,0.10)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

export { getPromptBounds };
