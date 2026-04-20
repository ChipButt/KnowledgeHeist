import { initUI } from './ui.js';
import { initGame } from './game.js';

let gameInstance = null;

initUI({
  onStartHeist: () => {
    if (gameInstance && typeof gameInstance.startHeist === 'function') {
      gameInstance.startHeist();
      return;
    }

    console.error('Game is not available yet.');
    alert('The game failed to load. Open the browser console to see the error.');
  }
});

try {
  gameInstance = initGame();
} catch (err) {
  console.error('Game boot failed:', err);
}
