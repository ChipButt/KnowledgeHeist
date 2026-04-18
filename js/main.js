import { initUI } from './ui.js';

let gameInstance = null;

const ui = initUI({
  onStartHeist: () => {
    if (gameInstance && typeof gameInstance.startHeist === 'function') {
      gameInstance.startHeist();
      return;
    }

    console.error('Game is not available yet.');
    alert('The game failed to load. Open the browser console to see the error.');
  }
});

(async () => {
  try {
    const gameModule = await import('./game.js');
    gameInstance = gameModule.initGame();
  } catch (err) {
    console.error('Game boot failed:', err);
  }
})();
