export const DEBUG = {
  interaction: false,
  layoutOverlay: false
};

export function drawInteractionDebug({ ctx, state, helpers }) {
  if (!DEBUG.interaction || !state.run) return;

  ctx.save();

  const playerPoint = helpers.getPlayerInteractPoint();
  ctx.strokeStyle = 'rgba(0,255,0,0.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(playerPoint.x, playerPoint.y, 10, 0, Math.PI * 2);
  ctx.stroke();

  state.run.items.forEach((item) => {
    if (item.status === 'stolen') return;

    const zone = helpers.getItemInteractZone(item);

    if (zone) {
      ctx.strokeStyle = 'rgba(0,255,0,0.95)';
      ctx.lineWidth = 2;
      ctx.strokeRect(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1);
      ctx.fillStyle = 'rgba(0,255,0,0.18)';
      ctx.fillRect(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.id, (zone.x1 + zone.x2) / 2, zone.y1 - 6);
      return;
    }

    const p = helpers.getItemInteractPoint(item);
    const r = helpers.getItemInteractRadius(item);

    ctx.strokeStyle = 'rgba(255,0,0,0.95)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
}

export function drawLayoutOverlay({
  ctx,
  VIEW_W,
  VIEW_H,
  helpers,
  getFloorPoly,
  getGuardDoorZone
}) {
  if (!DEBUG.layoutOverlay) return;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, VIEW_W - 2, VIEW_H - 2);

  const floorPoly = getFloorPoly();
  ctx.strokeStyle = 'rgba(0,255,255,0.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(floorPoly[0].x, floorPoly[0].y);
  for (let i = 1; i < floorPoly.length; i += 1) {
    ctx.lineTo(floorPoly[i].x, floorPoly[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  const exit = helpers.getExitZone();
  ctx.strokeStyle = 'rgba(255,255,0,0.95)';
  ctx.strokeRect(exit.x1, exit.y1, exit.x2 - exit.x1, exit.y2 - exit.y1);

  const guardDoor = getGuardDoorZone();
  ctx.strokeStyle = 'rgba(255,0,255,0.95)';
  ctx.strokeRect(
    guardDoor.x1,
    guardDoor.y1,
    guardDoor.x2 - guardDoor.x1,
    guardDoor.y2 - guardDoor.y1
  );

  ctx.restore();
}
