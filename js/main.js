import { initUI } from './ui.js';
import { initGame } from './game.js';
import { initFirebaseLeaderboardBridge } from './firebaseLeaderboard.js';

let gameInstance = null;

try {
  initFirebaseLeaderboardBridge();
} catch (err) {
  console.error('Firebase leaderboard init failed:', err);
}

try {
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
} catch (err) {
  console.error('UI init failed:', err);
}

try {
  gameInstance = initGame();
} catch (err) {
  console.error('Game boot failed:', err);
}
