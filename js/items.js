import {
  ITEM_INTERACT_ZONES_SOURCE,
  pointInRect,
  pointInPolygon
} from './zones.js';

/*
  IMPORTANT:
  - sourceBox = where the ART IMAGE is drawn
  - interact zone = where Nana can trigger GRAB
  These are NOT the same thing.
*/

const WALL_ITEM_SOURCE_BOXES = {
  'item-0': { x: 674, y: 357, w: 326, h: 146 },
  'item-1': { x: 1155, y: 308, w: 326, h: 146 },
  'item-2': { x: 1632, y: 354, w: 326, h: 146 },

  'item-3': { x: 394, y: 404, w: 149, h: 311 },
  'item-4': { x: 197, y: 626, w: 149, h: 311 },

  /* swapped */
  'item-5': { x: 2235, y: 601, w: 149, h: 311 },
  'item-6': { x: 2090, y: 418, w: 149, h: 311 }
};

const FLOOR_RANDOM_AREA_SOURCE = [
  { x: 685, y: 760 },
  { x: 1943, y: 760 },
  { x: 2137, y: 1093 },
  { x: 1844, y: 1092 },
  { x: 1930, y: 1318 },
  { x: 1598, y: 1318 },
  { x: 1576, y: 1179 },
  { x: 1002, y: 1179 },
  { x: 892, y: 1322 },
  { x: 388, y: 1318 }
];

const FLOOR_ITEM_SOURCE_DEFAULTS = {
  pedestal: { drawW: 96, drawH: 150, sourceSpriteW: 121, sourceSpriteH: 234 },
  aboard: { drawW: 104, drawH: 158, sourceSpriteW: 361, sourceSpriteH: 547 }
};

const FLOOR_ITEM_LOCAL_BLOCKERS = {
  pedestal: {
    x1: 10,
    y1: 164,
    x2: 114,
    y2: 224
  },
  aboard: {
    x1: 58,
    y1: 434,
    x2: 329,
    y2: 525
  }
};

function sourcePointInPoly(x, y, poly) {
  return pointInPolygon({ x, y }, poly);
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function getPolyBounds(poly) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, minY, maxX, maxY };
}

function randomPointInSourcePoly(poly, options = {}) {
  const { avoid = [], minDistance = 180, maxAttempts = 800 } = options;
  const bounds = getPolyBounds(poly);

  for (let i = 0; i < maxAttempts; i += 1) {
    const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);

    if (!sourcePointInPoly(x, y, poly)) continue;

    let tooClose = false;
    for (const other of avoid) {
      if (distance(x, y, other.x, other.y) < minDistance) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      return { x, y };
    }
  }

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };
}

export function getZoneCenter(zone) {
  if (!zone) return { x: 0, y: 0 };

  if (zone.type === 'poly') {
    const total = zone.points.reduce(
      (acc, point) => {
        acc.x += point.x;
        acc.y += point.y;
        return acc;
      },
      { x: 0, y: 0 }
    );

    return {
      x: total.x / zone.points.length,
      y: total.y / zone.points.length
    };
  }

  return {
    x: (zone.x1 + zone.x2) / 2,
    y: (zone.y1 + zone.y2) / 2
  };
}

export function pointInZone(px, py, zone) {
  if (!zone) return false;

  if (zone.type === 'poly') {
    return pointInPolygon({ x: px, y: py }, zone.points);
  }

  return pointInRect(px, py, zone);
}

export function getZoneRadius(zone) {
  if (!zone) return 0;

  if (zone.type === 'poly') {
    const center = getZoneCenter(zone);
    let maxDist = 0;

    for (const point of zone.points) {
      maxDist = Math.max(maxDist, distance(center.x, center.y, point.x, point.y));
    }

    return maxDist;
  }

  return Math.max(zone.x2 - zone.x1, zone.y2 - zone.y1) / 2;
}

function scaleInteractZone(zone, sx, sy) {
  if (!zone) return null;

  if (zone.type === 'poly') {
    return {
      type: 'poly',
      points: zone.points.map((point) => ({
        x: sx(point.x),
        y: sy(point.y)
      }))
    };
  }

  return {
    type: 'rect',
    x1: sx(zone.x1),
    y1: sy(zone.y1),
    x2: sx(zone.x2),
    y2: sy(zone.y2)
  };
}

function applyScaledGeometry(item, sx, sy) {
  if (item.type === 'wall') {
    item.x = sx(item.sourceBox.x);
    item.y = sy(item.sourceBox.y);
    item.w = sx(item.sourceBox.w);
    item.h = sy(item.sourceBox.h);
    item.anchorX = item.x + item.w / 2;
    item.anchorY = item.y + item.h;
    return;
  }

  item.anchorX = sx(item.sourceAnchorX);
  item.anchorY = sy(item.sourceAnchorY);
  item.drawW = sx(item.sourceDrawW);
  item.drawH = sy(item.sourceDrawH);
}

function getFloorItemDrawTopLeft(item) {
  return {
    drawX: item.anchorX - item.drawW / 2,
    drawY: item.anchorY - item.drawH
  };
}

function getLocalRectAsWorldRect(item, rect) {
  const { drawX, drawY } = getFloorItemDrawTopLeft(item);
  const spriteW = item.sourceSpriteW || item.sourceDrawW || 1;
  const spriteH = item.sourceSpriteH || item.sourceDrawH || 1;

  return {
    x1: drawX + (rect.x1 / spriteW) * item.drawW,
    y1: drawY + (rect.y1 / spriteH) * item.drawH,
    x2: drawX + (rect.x2 / spriteW) * item.drawW,
    y2: drawY + (rect.y2 / spriteH) * item.drawH
  };
}

function getFloorBlockerRect(item) {
  const blocker = FLOOR_ITEM_LOCAL_BLOCKERS[item.floorKind];
  if (!blocker) return null;
  return getLocalRectAsWorldRect(item, blocker);
}

function getExpandedFloorGrabRect(item) {
  const blocker = FLOOR_ITEM_LOCAL_BLOCKERS[item.floorKind];
  if (!blocker) return null;

  const expand = (item.sourceSpriteW || item.sourceDrawW || 0) / 2;

  return getLocalRectAsWorldRect(item, {
    x1: blocker.x1 - expand,
    y1: blocker.y1 - expand,
    x2: blocker.x2 + expand,
    y2: blocker.y2 + expand
  });
}

export function getFloorItemBlocker(item) {
  if (!item || item.type !== 'floor' || item.status === 'stolen') return null;
  return getFloorBlockerRect(item);
}

export function pointHitsFloorBlocker(items, px, py) {
  for (const item of items) {
    const blocker = getFloorItemBlocker(item);
    if (blocker && pointInRect(px, py, blocker)) return true;
  }
  return false;
}

export function createHeistItems({ assets, sx, sy }) {
  const items = [];

  const wallItems = [
    {
      id: 'item-0',
      type: 'wall',
      wall: 'north',
      status: 'available',
      question: null,
      image: assets.artImages.northA
    },
    {
      id: 'item-1',
      type: 'wall',
      wall: 'north',
      status: 'available',
      question: null,
      image: assets.artImages.northB
    },
    {
      id: 'item-2',
      type: 'wall',
      wall: 'north',
      status: 'available',
      question: null,
      image: assets.artImages.northC
    },
    {
      id: 'item-3',
      type: 'wall',
      wall: 'west',
      status: 'available',
      question: null,
      image: assets.artImages.westA
    },
    {
      id: 'item-4',
      type: 'wall',
      wall: 'west',
      status: 'available',
      question: null,
      image: [
        assets.artImages.westB,
        assets.artImages.westC,
        assets.artImages.westD
      ][Math.floor(Math.random() * 3)]
    },
    {
      id: 'item-5',
      type: 'wall',
      wall: 'east',
      status: 'available',
      question: null,
      image: assets.artImages.eastA
    },
    {
      id: 'item-6',
      type: 'wall',
      wall: 'east',
      status: 'available',
      question: null,
      image: assets.artImages.eastB
    }
  ];

  wallItems.forEach((item) => {
    item.sourceBox = { ...WALL_ITEM_SOURCE_BOXES[item.id] };
    applyScaledGeometry(item, sx, sy);
    items.push(item);
  });

  const pedestalPos = randomPointInSourcePoly(FLOOR_RANDOM_AREA_SOURCE);

  const pedestal = {
    id: 'item-7',
    type: 'floor',
    floorKind: 'pedestal',
    status: 'available',
    question: null,
    image: assets.artImages.pedestal,
    sourceAnchorX: pedestalPos.x,
    sourceAnchorY: pedestalPos.y,
    sourceDrawW: FLOOR_ITEM_SOURCE_DEFAULTS.pedestal.drawW,
    sourceDrawH: FLOOR_ITEM_SOURCE_DEFAULTS.pedestal.drawH,
    sourceSpriteW: FLOOR_ITEM_SOURCE_DEFAULTS.pedestal.sourceSpriteW,
    sourceSpriteH: FLOOR_ITEM_SOURCE_DEFAULTS.pedestal.sourceSpriteH
  };
  applyScaledGeometry(pedestal, sx, sy);
  items.push(pedestal);

  const aboardPos = randomPointInSourcePoly(FLOOR_RANDOM_AREA_SOURCE, {
    avoid: [{ x: pedestalPos.x, y: pedestalPos.y }],
    minDistance: 220
  });

  const aboard = {
    id: 'item-8',
    type: 'floor',
    floorKind: 'aboard',
    status: 'available',
    question: null,
    image: assets.artImages.aboard,
    sourceAnchorX: aboardPos.x,
    sourceAnchorY: aboardPos.y,
    sourceDrawW: FLOOR_ITEM_SOURCE_DEFAULTS.aboard.drawW,
    sourceDrawH: FLOOR_ITEM_SOURCE_DEFAULTS.aboard.drawH,
    sourceSpriteW: FLOOR_ITEM_SOURCE_DEFAULTS.aboard.sourceSpriteW,
    sourceSpriteH: FLOOR_ITEM_SOURCE_DEFAULTS.aboard.sourceSpriteH
  };
  applyScaledGeometry(aboard, sx, sy);
  items.push(aboard);

  return items;
}

export function buildScaledRunData(run, sx, sy) {
  if (!run) return;

  for (const item of run.items) {
    applyScaledGeometry(item, sx, sy);
  }
}

export function getItemInteractZone(item, sx, sy) {
  if (!item) return null;

  if (item.type === 'floor') {
    return getExpandedFloorGrabRect(item);
  }

  const zone = ITEM_INTERACT_ZONES_SOURCE[item.id];
  if (!zone) return null;

  return scaleInteractZone(zone, sx, sy);
}

export function getItemInteractPoint(item, sx, sy) {
  const zone = getItemInteractZone(item, sx, sy);

  if (zone) {
    return getZoneCenter(zone);
  }

  return {
    x: item.anchorX,
    y: item.anchorY
  };
}

export function getItemInteractRadius(item, sx, sy) {
  const zone = getItemInteractZone(item, sx, sy);

  if (zone) {
    return getZoneRadius(zone);
  }

  if (item.type === 'floor') return Math.max(34, sx(44));
  return Math.max(30, sx(42));
}
