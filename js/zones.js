const SOURCE_W = 2816;
const SOURCE_H = 1536;

export const ITEM_INTERACT_ZONES_SOURCE = {
  'item-0': { x1: 850, y1: 655, x2: 996, y2: 708 },
  'item-1': { x1: 1332, y1: 654, x2: 1496, y2: 708 },
  'item-2': { x1: 1862, y1: 655, x2: 2022, y2: 709 },
  'item-3': { x1: 446, y1: 760, x2: 566, y2: 888 },
  'item-4': { x1: 286, y1: 1038, x2: 434, y2: 1168 },
  'item-5': { x1: 2188, y1: 714, x2: 2326, y2: 848 },
  'item-6': { x1: 2328, y1: 930, x2: 2484, y2: 1066 }
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
