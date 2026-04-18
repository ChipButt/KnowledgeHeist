import { initUI } from './ui.js';
import { initGame } from './game.js';

const game = initGame();

initUI({
  onStartHeist: game.startHeist
});
