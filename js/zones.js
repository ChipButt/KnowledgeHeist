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
      { x: 240, y: 1100 },
      { x: 450, y: 1100 },
      { x: 552, y: 926 },
      { x: 395, y: 908 }
    ]
  },

  /* item-5 and item-6 hitboxes swapped to match the correct images */
  'item-5': {
    type: 'poly',
    points: [
      { x: 2228, y: 902 },
      { x: 2323, y: 1031 },
      { x: 2237, y: 1031 },
      { x: 2158, y: 910 }
    ]
  },

  'item-6': {
    type: 'poly',
    points: [
      { x: 2091, y: 725 },
      { x: 2170, y: 829 },
      { x: 2110, y: 833 },
      { x: 2015, y: 703 }
    ]
  }
};

export function createScaler(getViewSize) {
  return {
    sx: (x) => (x / SOURCE_W) * getViewSize().width,
    sy: (y) => (y / SOURCE_H) * getViewSize().height
  };
}

export function getFloorPoly(sx, sy) {
  return [
    { x: sx(581), y: sy(662) },
    { x: sx(2048), y: sy(662) },
    { x: sx(2616), y: sy(1480) },
    { x: sx(20), y: sy(1480) }
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
    type: 'poly',
    points: [
      { x: sx(2426), y: sy(1174) },
      { x: sx(2537), y: sy(1318) },
      { x: sx(2460), y: sy(1318) },
      { x: sx(2354), y: sy(1194) }
    ]
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

export function pointInZone(point, zone) {
  if (!zone) return false;

  if (zone.type === 'poly') {
    return pointInPolygon(point, zone.points);
  }

  return pointInRect(point.x, point.y, zone);
}
