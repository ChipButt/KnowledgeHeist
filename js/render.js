export function drawRoom(runtime) {
    const { canvas, ctx, state, helpers } = runtime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Example: draw the room background
    if (state.roomBackground) {
        ctx.drawImage(state.roomBackground, 0, 0, canvas.width, canvas.height);
    }

    // Draw your items and player as you normally do here.
    // (This assumes you have existing code to draw them.)

    // Debug: Draw interaction zones
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;

    // Example: draw a rectangle around an interaction zone (customize as needed)
    const interactionZones = helpers.getAllInteractionZones(); // This should return zones (x, y, width, height)
    interactionZones.forEach(zone => {
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
    });

    ctx.restore();
}
