export const DEBUG = {
  interaction: false,
  layoutOverlay: false
};

function drawRect(ctx, rect, strokeStyle = '#00ff88', lineWidth = 2) {
  if (!rect) return;
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
  ctx.restore();
}

function drawPoly(ctx, points, strokeStyle = '#00ff88', lineWidth = 2) {
  if (!points || !points.length) return;

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawZone(ctx, zone, strokeStyle = '#00ff88', lineWidth = 2) {
  if (!zone) return;

  if (zone.type === 'poly') {
    drawPoly(ctx, zone.points, strokeStyle, lineWidth);
    return;
  }

  drawRect(ctx, zone, strokeStyle, lineWidth);
}

function drawPoint(ctx, x, y, color = '#ffffff', radius = 4) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLabel(ctx, text, x, y, color = '#ffffff', bg = 'rgba(0,0,0,0.7)') {
  ctx.save();
  ctx.font = '12px Arial';
  const metrics = ctx.measureText(text);
  const w = metrics.width + 8;
  const h = 18;

  ctx.fillStyle = bg;
  ctx.fillRect(x, y - 14, w, h);

  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 4, y - 5);
  ctx.restore();
}

export function drawInteractionDebug({ ctx, state, helpers }) {
  if (!DEBUG.interaction) return;
  if (!state.run) return;

  const items = state.run.items || [];

  ctx.save();

  for (const item of items) {
    if (item.status === 'stolen') continue;

    if (item.type === 'floor') {
      const blocker = helpers.getFloorItemBlocker(item);
      if (blocker) {
        drawRect(ctx, blocker, '#ff3b30', 2);
        drawLabel(ctx, `${item.id} blocker`, blocker.x1, blocker.y1 - 2, '#ffb3ad');
      }
    }

    const zone = helpers.getItemInteractZone(item);
    if (zone) {
      drawZone(ctx, zone, '#00d5ff', 2);
    }

    const point = helpers.getItemInteractPoint(item);
    if (point) {
      drawPoint(ctx, point.x, point.y, '#00d5ff', 3);
      drawLabel(ctx, `${item.id} ${item.type}`, point.x + 6, point.y - 6, '#b8f4ff');
    }
  }

  const playerPoint = helpers.getPlayerInteractPoint();
  if (playerPoint) {
    drawPoint(ctx, playerPoint.x, playerPoint.y, '#ffff00', 5);
    drawLabel(ctx, 'player feet', playerPoint.x + 8, playerPoint.y - 8, '#fff799');
  }

  const nearby = helpers.getNearbyItem?.();
  if (nearby) {
    const point = helpers.getItemInteractPoint(nearby);
    if (point) {
      drawPoint(ctx, point.x, point.y, '#00ff88', 5);
      drawLabel(ctx, `nearby: ${nearby.id}`, point.x + 8, point.y + 12, '#b9ffd8');
    }
  }

  ctx.restore();
}

export function drawLayoutOverlay({
  ctx,
  VIEW_W,
  VIEW_H,
  getFloorPoly,
  getGuardDoorZone
}) {
  if (!DEBUG.layoutOverlay) return;

  ctx.save();

  const floorPoly = getFloorPoly?.();
  if (floorPoly?.length) {
    drawPoly(ctx, floorPoly, '#ffd60a', 2);
    drawLabel(ctx, 'floor poly', floorPoly[0].x, floorPoly[0].y - 8, '#fff0a8');
  }

  const guardDoor = getGuardDoorZone?.();
  if (guardDoor) {
    drawZone(ctx, guardDoor, '#ff00ff', 2);
    const labelX = guardDoor.type === 'poly' ? guardDoor.points[0].x : guardDoor.x1;
    const labelY = guardDoor.type === 'poly' ? guardDoor.points[0].y : guardDoor.y1;
    drawLabel(ctx, 'guard door', labelX, labelY - 8, '#ffb3ff');
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();

  ctx.restore();
}
