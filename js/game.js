import { createAssets } from './assets.js';
import { createBaseState } from './gameState.js';
import { createScaler } from './zones.js';
import { GAME_CONSTANTS } from './gameConfig.js';
import { createGameUI } from './gameUIRuntime.js';
import { createGameRuntime } from './gameRuntime.js';
import { createGameSession } from './gameSession.js';
import { registerGameEvents } from './gameEvents.js';

function getGameRefs() {
  const questionModal = document.getElementById('questionModal');
  const homeworkOverlay = document.getElementById('homeworkOverlay');

  return {
    hubScreen: document.getElementById('hubScreen'),
    gameScreen: document.getElementById('gameScreen'),
    backToHubBtn: document.getElementById('backToHubBtn'),

    haulValueEl: document.getElementById('haulValue'),
    strikesValueEl: document.getElementById('strikesValue'),
    paintingsLeftValueEl: document.getElementById('paintingsLeftValue'),

    questionModal,
    questionTextEl: document.getElementById('questionText'),
    answerInput: document.getElementById('answerInput'),
    submitAnswerBtn: document.getElementById('submitAnswerBtn'),
    cancelAnswerBtn: document.getElementById('cancelAnswerBtn'),

    summaryOverlay: document.getElementById('summaryOverlay'),
    summaryContinueBtn: document.getElementById('summaryContinueBtn'),

    banner: document.getElementById('gameBanner'),
    rotateDeviceOverlay: document.getElementById('rotateDeviceOverlay'),

    confirmChoiceOverlay: document.getElementById('confirmChoiceOverlay'),
    confirmChoiceTitle: document.getElementById('confirmChoiceTitle'),
    confirmChoiceText: document.getElementById('confirmChoiceText'),
    confirmChoiceYesBtn: document.getElementById('confirmChoiceYesBtn'),
    confirmChoiceNoBtn: document.getElementById('confirmChoiceNoBtn'),

    homeworkOverlay,
    homeworkCloseBtn: document.getElementById('homeworkCloseBtn'),
    homeworkTitle: document.getElementById('homeworkTitle'),
    homeworkSub: homeworkOverlay?.querySelector('.chalk-sub'),
    homeworkList: document.getElementById('homeworkList'),

    canvas: document.getElementById('gameCanvas')
  };
}

export function initGame() {
  const refs = getGameRefs();

  if (!refs.canvas) throw new Error('Missing #gameCanvas');

  const ctx = refs.canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');

  const assets = createAssets();
  const state = createBaseState();

  const view = {
    width: refs.canvas.width,
    height: refs.canvas.height
  };

  const scaler = createScaler(() => ({ width: view.width, height: view.height }));

  const context = {
    refs,
    canvas: refs.canvas,
    ctx,
    assets,
    state,
    constants: GAME_CONSTANTS,
    view,
    sx: scaler.sx,
    sy: scaler.sy
  };

  const ui = createGameUI(context);

  let session = null;
  const runtime = createGameRuntime(context, {
    ui,
    get session() {
      return session;
    }
  });

  session = createGameSession(context, {
    ui,
    runtime
  });

  registerGameEvents(context, {
    ui,
    runtime,
    session
  });

  session.showScreen('hub');
  runtime.resizeCanvas();
  session.updateOrientationState();
  requestAnimationFrame(runtime.gameLoop);

  return {
    startHeist: session.startHeist
  };
}
