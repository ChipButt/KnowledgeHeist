import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

import { loadSave, loadSettings } from './storage.js';
import { sanitizePlayerName } from './settings.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBQ9VJZFTZfqDUHlxFVk9M-ZJqOun8osao',
  authDomain: 'knowledge-heist-fae7e.firebaseapp.com',
  projectId: 'knowledge-heist-fae7e',
  storageBucket: 'knowledge-heist-fae7e.firebasestorage.app',
  messagingSenderId: '199523976322',
  appId: '1:199523976322:web:8ab66a3b8cc780398d609b',
  measurementId: 'G-L9ER9D599P'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function buildPlayerKey(displayName) {
  return sanitizePlayerName(displayName)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .slice(0, 40);
}

function normaliseRow(data) {
  return {
    name: sanitizePlayerName(data.displayName || 'Player') || 'Player',
    totalBanked: Number(data.totalBanked || 0),
    bestHeist: Number(data.bestHeist || 0),
    heistsPlayed: Number(data.heistsPlayed || 0),
    paintingsStolen: Number(data.paintingsStolen || 0),
    updatedAtMs: Number(data.updatedAtMs || 0)
  };
}

export async function fetchUnifiedLeaderboardRows() {
  const leaderboardRef = collection(db, 'leaderboard');
  const q = query(leaderboardRef, orderBy('totalBanked', 'desc'), limit(100));
  const snap = await getDocs(q);

  const rows = snap.docs
    .map((docSnap) => normaliseRow(docSnap.data()))
    .filter((row) => row.totalBanked > 0 || row.bestHeist > 0);

  rows.sort((a, b) => {
    if (b.totalBanked !== a.totalBanked) return b.totalBanked - a.totalBanked;
    if (b.bestHeist !== a.bestHeist) return b.bestHeist - a.bestHeist;
    if (b.heistsPlayed !== a.heistsPlayed) return b.heistsPlayed - a.heistsPlayed;
    return a.name.localeCompare(b.name);
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    ...row
  }));
}

export async function submitCurrentPlayerLeaderboard() {
  const save = loadSave();
  const settings = loadSettings();

  const displayName = sanitizePlayerName(settings.playerName);
  if (!displayName) return;
  if (
    Number(save.totalBanked || 0) <= 0 &&
    Number(save.bestHeist || 0) <= 0 &&
    Number(save.heistsPlayed || 0) <= 0
  ) {
    return;
  }

  const playerKey = buildPlayerKey(displayName);
  if (!playerKey) return;

  const playerRef = doc(db, 'leaderboard', playerKey);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(playerRef);
    const prev = snap.exists() ? snap.data() : {};

    transaction.set(
      playerRef,
      {
        playerKey,
        displayName,
        totalBanked: Math.max(Number(prev.totalBanked || 0), Number(save.totalBanked || 0)),
        bestHeist: Math.max(Number(prev.bestHeist || 0), Number(save.bestHeist || 0)),
        heistsPlayed: Math.max(Number(prev.heistsPlayed || 0), Number(save.heistsPlayed || 0)),
        paintingsStolen: Math.max(Number(prev.paintingsStolen || 0), Number(save.paintingsStolen || 0)),
        updatedAt: serverTimestamp(),
        updatedAtMs: Date.now()
      },
      { merge: true }
    );
  });
}

export function initFirebaseLeaderboardBridge() {
  window.nanaHeistUnifiedLeaderboardProvider = fetchUnifiedLeaderboardRows;

  let submitTimer = null;

  const scheduleSubmit = () => {
    clearTimeout(submitTimer);
    submitTimer = setTimeout(() => {
      submitCurrentPlayerLeaderboard().catch((err) => {
        console.error('Leaderboard submit failed:', err);
      });
    }, 350);
  };

  window.addEventListener('nanaheist:data-updated', scheduleSubmit);
  window.addEventListener('nanaheist:settings-updated', scheduleSubmit);

  scheduleSubmit();
}
