export const DEBUG = {
  interaction: false,
  layoutOverlay: true
};

export function drawInteractionDebug() {
  /* intentionally disabled */
}

export function drawLayoutOverlay({
  ctx,
  helpers
}) {
  if (!DEBUG.layoutOverlay) return;

  const exit = helpers.getExitZone();
  if (!exit) return;

  ctx.save();

  ctx.fillStyle = 'rgba(70, 70, 70, 0.38)';
  ctx.fillRect(exit.x1, exit.y1, exit.x2 - exit.x1, exit.y2 - exit.y1);

  ctx.strokeStyle = 'rgba(52, 52, 52, 0.95)';
  ctx.lineWidth = 2;
  ctx.strokeRect(exit.x1, exit.y1, exit.x2 - exit.x1, exit.y2 - exit.y1);

  ctx.restore();
}
