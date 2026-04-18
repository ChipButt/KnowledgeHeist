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
  const g = ctx.createLinearGradient(0, 0, 0,
