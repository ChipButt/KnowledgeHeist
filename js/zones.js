const SOURCE_W = 2816;
const SOURCE_H = 1536;

export const ITEM_INTERACT_ZONES_SOURCE = {
  'item-0': { x1: 814, y1: 644, x2: 974, y2: 685 },
  'item-1': { x1: 1331, y1: 645, x2: 1492, y2: 686 },
  'item-2': { x1: 1848, y1: 645, x2: 2008, y2: 686 },
  'item-3': { x1: 498, y1: 752, x2: 609, y2: 889 },
  'item-4': { x1: 292, y1: 1032, x2: 410, y2: 1161 },
  'item-5': { x1: 2155, y1: 683, x2: 2263, y2: 821 },
  'item-6': { x1: 2293, y1: 861, x2: 2451, y2: 1083 }
};

export function createScaler(getViewSize) {
  return {
    sx: (x) => (x / SOURCE_W) * getViewSize().width,
    sy: (y) => (y / SOURCE_H) * getViewSize().height
  };
}

export function getFloorPoly(sx, sy) {
  return [
    { x: sx(738), y: sy(730) },
    { x: sx(2073), y: sy(730) },
    { x: sx(2505), y: sy(1360) },
    { x: sx(281), y: sy(1360) }
  ];
}

export function getExitZone(sx, sy) {
  return {
    x1: sx(1180),
    y1: sy(1280),
    x2: sx(1640),
    y2: sy(1495)
  };
}

export function getGuardDoorZone(sx, sy) {
  return {
    x1: sx(2522),
    y1: sy(1174),
    x2: sx(2639),
    y2: sy(1325)
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
