import { loadSave } from './storage.js';

export function createBaseState() {
  return {
    save: loadSave(),
    homework: {
      pending: []
    },
    screen: 'hub',
    keys: { up: false, down: false, left: false, right: false },
    run: null,
    activeItem: null,
    lastTimestamp: 0,
    player: createPlayerState(0, 0),
    guard: createGuardState(0, 0),
    fx: {
      wrongFlashTimer: 0,
      guardFlashTimer: 0,
      shakeTimer: 0,
      shakeX: 0,
      shakeY: 0
    },
    audio: {
      sirenStarted: false,
      withMePlayed: false,
      withMeFinished: true
    },
    pointer: createPointerState(),
    confirm: {
      open: false,
      onConfirm: null,
      onCancel: null
    }
  };
}

export function createPointerState() {
  return {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dragX: 0,
    dragY: 0
  };
}

export function createPlayerState(x, y) {
  return {
    x,
    y,
    direction: 'south',
    moving: false,
    visible: true,
    controlLocked: false,
    walkFrameIndex: 0,
    walkFrameTimer: 0,
    action: null
  };
}

export function createGuardState(x, y) {
  return {
    x,
    y,
    direction: 'south-west',
    active: false,
    visible: true,
    mode: 'run',
    frameIndex: 0,
    frameTimer: 0,
    moving: false
  };
}

export function createRunState(items, failVoicePool) {
  return {
    haul: 0,
    strikes: 0,
    items,
    wrongQuestions: [],
    ended: false,
    mode: 'play',
    failVoicePool,
    wasInExitZone: false
  };
}
