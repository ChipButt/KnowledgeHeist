import {
  ITEM_INTERACT_ZONES_SOURCE,
  pointInRect,
  pointInPolygon
} from './zones.js';

const WALL_ITEM_SOURCE_BOXES = {
  'item-0': { x: 716, y: 661, w: 164, h: 27 },
  'item-1': { x: 1196, y: 643, w: 212, h: 46 },
  'item-2': { x: 1713, y: 643, w: 182, h: 46 },

  'item-3': { x: 448, y: 718, w: 138, h: 120 },
  'item-4': { x: 232, y: 1022, w: 137, h: 132 },

  /* best-effort until exact right wall art boxes are supplied */
  'item-5': { x: 2188, y: 714, w: 138, h: 134 },
  'item-6': { x: 2328, y: 930, w: 156, h: 136 }
};

const FLOOR_ITEM_SOURCE_ANCHORS = {
  /* locked source-space anchors so they stay stable across desktop/mobile */
  pedestal: { x: 1360, y: 1115, drawW: 96, drawH: 150 },
  aboard: { x: 2060, y: 1128, drawW: 104, drawH: 158 }
};

export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
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

export function getFloorItemBlocker(item) {
  if (!item || item.type !== 'floor' || item.status === 'stolen') return null;

  return {
    x1: item.anchorX - item.drawW * 0.46,
    y1: item.anchorY - item.drawH * 0.18,
    x2: item.anchorX + item.drawW * 0.46,
    y2: item.anchorY + 10
  };
}

export function pointHitsFloorBlocker(items, px, py) {
  for (const item of items) {
    const blocker = getFloorItemBlocker(item);
    if (blocker && pointInRect(px, py, blocker)) return true;
  }
  return false;
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

  const pedestal = {
    id: 'item-7',
    type: 'floor',
    floorKind: 'pedestal',
    status: 'available',
    question: null,
    image: assets.artImages.pedestal,
    sourceAnchorX: FLOOR_ITEM_SOURCE_ANCHORS.pedestal.x,
    sourceAnchorY: FLOOR_ITEM_SOURCE_ANCHORS.pedestal.y,
    sourceDrawW: FLOOR_ITEM_SOURCE_ANCHORS.pedestal.drawW,
    sourceDrawH: FLOOR_ITEM_SOURCE_ANCHORS.pedestal.drawH
  };
  applyScaledGeometry(pedestal, sx, sy);
  items.push(pedestal);

  const aboard = {
    id: 'item-8',
    type: 'floor',
    floorKind: 'aboard',
    status: 'available',
    question: null,
    image: assets.artImages.aboard,
    sourceAnchorX: FLOOR_ITEM_SOURCE_ANCHORS.aboard.x,
    sourceAnchorY: FLOOR_ITEM_SOURCE_ANCHORS.aboard.y,
    sourceDrawW: FLOOR_ITEM_SOURCE_ANCHORS.aboard.drawW,
    sourceDrawH: FLOOR_ITEM_SOURCE_ANCHORS.aboard.drawH
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
    const widthMul = item.floorKind === 'pedestal' ? 0.38 : 0.24;
    const zoneHeight = item.floorKind === 'pedestal'
      ? Math.max(10, item.drawH * 0.12)
      : Math.max(12, item.drawH * 0.18);

    const x1 = item.anchorX - item.drawW * widthMul;
    const x2 = item.anchorX + item.drawW * widthMul;
    const y2 = item.anchorY + 2;
    const y1 = y2 - zoneHeight;

    return { type: 'rect', x1, y1, x2, y2 };
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
