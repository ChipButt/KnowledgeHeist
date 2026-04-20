import {
  ITEM_INTERACT_ZONES_SOURCE,
  pointInRect,
  pointInPolygon
} from './zones.js';

export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function getZoneCenter(zone) {
  if (!zone) {
    return { x: 0, y: 0 };
  }

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

export function randomFloorPoint({
  minX,
  maxX,
  minY,
  maxY,
  avoid = [],
  isWalkablePoint,
  exitZone,
  sx,
  sy
}) {
  for (let i = 0; i < 500; i += 1) {
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);

    if (!isWalkablePoint(x, y)) continue;
    if (pointInRect(x, y, exitZone)) continue;
    if (distance(x, y, sx(1410), sy(1220)) < 90) continue;

    let tooClose = false;
    for (const other of avoid) {
      if (distance(x, y, other.x, other.y) < 150) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) return { x, y };
  }

  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function createHeistItems({
  VIEW_W,
  VIEW_H,
  sx,
  sy,
  assets,
  isWalkablePoint,
  getExitZone
}) {
  const items = [];
  const cx = (x) => (x / 1024) * VIEW_W;
  const cy = (y) => (y / 670) * VIEW_H;

  const northSlots = [
    {
      x: sx(898 - 175),
      y: sy(443 - 75),
      w: sx(350),
      h: sy(150),
      anchorX: cx(305),
      anchorY: cy(289),
      wall: 'north',
      image: assets.artImages.northA
    },
    {
      x: sx(1414 - 175),
      y: sy(393 - 75),
      w: sx(350),
      h: sy(150),
      anchorX: cx(479),
      anchorY: cy(286),
      wall: 'north',
      image: assets.artImages.northB
    },
    {
      x: sx(1925 - 175),
      y: sy(440 - 75),
      w: sx(350),
      h: sy(150),
      anchorX: cx(655),
      anchorY: cy(286),
      wall: 'north',
      image: assets.artImages.northC
    }
  ];

  const westSlots = [
    {
      x: sx(503 - 80),
      y: sy(576 - 160),
      w: sx(160),
      h: sy(320),
      anchorX: cx(223),
      anchorY: cy(342),
      wall: 'west',
      image: assets.artImages.westA
    },
    {
      x: sx(291 - 80),
      y: sy(806 - 160),
      w: sx(160),
      h: sy(320),
      anchorX: cx(149),
      anchorY: cy(464),
      wall: 'west',
      image: [
        assets.artImages.westB,
        assets.artImages.westC,
        assets.artImages.westD
      ][Math.floor(Math.random() * 3)]
    }
  ];

  const eastSlots = [
    {
      x: sx(2219 - 80),
      y: sy(525 - 160),
      w: sx(160),
      h: sy(320),
      anchorX: cx(732),
      anchorY: cy(324),
      wall: 'east',
      image: assets.artImages.eastA
    },
    {
      x: sx(2405 - 80),
      y: sy(721 - 160),
      w: sx(160),
      h: sy(320),
      anchorX: cx(779),
      anchorY: cy(401),
      wall: 'east',
      image: assets.artImages.eastB
    }
  ];

  let index = 0;

  northSlots.forEach((slot) => {
    items.push({
      id: `item-${index++}`,
      type: 'wall',
      status: 'available',
      question: null,
      ...slot
    });
  });

  westSlots.forEach((slot) => {
    items.push({
      id: `item-${index++}`,
      type: 'wall',
      status: 'available',
      question: null,
      ...slot
    });
  });

  eastSlots.forEach((slot) => {
    items.push({
      id: `item-${index++}`,
      type: 'wall',
      status: 'available',
      question: null,
      ...slot
    });
  });

  const exitZone = getExitZone();

  const pedestalPos = randomFloorPoint({
    minX: sx(1050),
    maxX: sx(1700),
    minY: sy(930),
    maxY: sy(1190),
    avoid: [],
    isWalkablePoint,
    exitZone,
    sx,
    sy
  });

  items.push({
    id: `item-${index++}`,
    type: 'floor',
    floorKind: 'pedestal',
    status: 'available',
    question: null,
    image: assets.artImages.pedestal,
    anchorX: pedestalPos.x,
    anchorY: pedestalPos.y - cy(10),
    drawW: 80,
    drawH: 118
  });

  const aboardPos = randomFloorPoint({
    minX: sx(1820),
    maxX: sx(2230),
    minY: sy(930),
    maxY: sy(1220),
    avoid: [{ x: pedestalPos.x, y: pedestalPos.y - cy(10) }],
    isWalkablePoint,
    exitZone,
    sx,
    sy
  });

  items.push({
    id: `item-${index}`,
    type: 'floor',
    floorKind: 'aboard',
    status: 'available',
    question: null,
    image: assets.artImages.aboard,
    anchorX: aboardPos.x,
    anchorY: aboardPos.y - cy(10),
    drawW: 84,
    drawH: 122
  });

  return items;
}

export function buildScaledRunData(run, sx, sy) {
  for (const item of run.items) {
    if (item.type === 'floor') {
      if (item.floorKind === 'pedestal') {
        item.drawW = Math.max(74, sx(96));
        item.drawH = Math.max(108, sy(150));
      } else {
        item.drawW = Math.max(78, sx(104));
        item.drawH = Math.max(112, sy(158));
      }
    }
  }
}

function scaleValue(value, fromSize, toSize) {
  if (!fromSize) return value;
  return value * (toSize / fromSize);
}

export function rescaleActiveRun({ state, prevW, prevH, nextW, nextH }) {
  if (!state.run || !prevW || !prevH) return;

  for (const item of state.run.items) {
    if (typeof item.x === 'number') item.x = scaleValue(item.x, prevW, nextW);
    if (typeof item.y === 'number') item.y = scaleValue(item.y, prevH, nextH);
    if (typeof item.w === 'number') item.w = scaleValue(item.w, prevW, nextW);
    if (typeof item.h === 'number') item.h = scaleValue(item.h, prevH, nextH);
    if (typeof item.anchorX === 'number') item.anchorX = scaleValue(item.anchorX, prevW, nextW);
    if (typeof item.anchorY === 'number') item.anchorY = scaleValue(item.anchorY, prevH, nextH);
    if (typeof item.drawW === 'number') item.drawW = scaleValue(item.drawW, prevW, nextW);
    if (typeof item.drawH === 'number') item.drawH = scaleValue(item.drawH, prevH, nextH);
  }

  state.player.x = scaleValue(state.player.x, prevW, nextW);
  state.player.y = scaleValue(state.player.y, prevH, nextH);
  state.guard.x = scaleValue(state.guard.x, prevW, nextW);
  state.guard.y = scaleValue(state.guard.y, prevH, nextH);
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
