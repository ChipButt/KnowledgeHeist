const SOURCE_W = 2626;
const SOURCE_H = 1490;

export { SOURCE_W, SOURCE_H };

export const ITEM_INTERACT_ZONES_SOURCE = {
  'item-0': { type: 'rect', x1: 716, y1: 661, x2: 880, y2: 688 },
  'item-1': { type: 'rect', x1: 1196, y1: 643, x2: 1408, y2: 689 },
  'item-2': { type: 'rect', x1: 1713, y1: 643, x2: 1895, y2: 689 },

  'item-3': {
    type: 'poly',
    points: [
      { x: 529, y: 734 },
      { x: 448, y: 836 },
      { x: 500, y: 838 },
      { x: 586, y: 718 }
    ]
  },
  'item-4': {
    type: 'poly',
    points: [
      { x: 308, y: 1022 },
      { x: 369, y: 1022 },
      { x: 274, y: 1154 },
      { x: 232, y: 1142 }
    ]
  },

  /* best-effort until you give exact right wall coords */
  'item-5': { type: 'rect', x1: 2188, y1: 714, x2: 2326, y2: 848 },
  'item-6': { type: 'rect', x1: 2328, y1: 930, x2: 2484, y2: 1066 }
};

export function createScaler(getViewSize) {
  return {
    sx: (x) => (x / SOURCE_W) * getViewSize().width,
    sy: (y) => (y / SOURCE_H) * getViewSize().height
  };
}

export function getFloorPoly(sx, sy) {
  return [
    { x: sx(596), y: sy(684) },
    { x: sx(2036), y: sy(684) },
    { x: sx(2584), y: sy(1411) },
    { x: sx(54), y: sy(1411) }
  ];
}

export function getExitZone(sx, sy) {
  return {
    x1: sx(1150),
    y1: sy(1435),
    x2: sx(1427),
    y2: sy(1490)
  };
}

export function getGuardDoorZone(sx, sy) {
  return {
    x1: sx(2426),
    y1: sy(1179),
    x2: sx(2476),
    y2: sy(1321)
  };
}

export function pointInRect(px, py, rect) {
  return px >= rect.x1 && px <= rect.x2 && py >= rect.y1 && py <= rect.y2;
}

export function pointInPolygon(point, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      (yi > point.y) !== (yj > point.y) &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.000001) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}
