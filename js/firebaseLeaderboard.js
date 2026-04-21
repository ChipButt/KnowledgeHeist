import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

import { loadSave, getActiveProfileName } from './storage.js';
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
const auth = getAuth(app);
const db = getFirestore(app);

let currentUid = null;
let anonAuthPromise = null;

onAuthStateChanged(auth, (user) => {
  if (user?.uid) currentUid = user.uid;
});

async function ensureAnonymousAuth() {
  if (auth.currentUser?.uid) {
    currentUid = auth.currentUser.uid;
    return auth.currentUser;
  }

  if (!anonAuthPromise) {
    anonAuthPromise = signInAnonymously(auth)
      .then((cred) => {
        currentUid = cred.user.uid;
        return cred.user;
      })
      .catch((err) => {
        console.error('Anonymous auth failed:', err);
        return null;
      });
  }

  return anonAuthPromise;
}

function buildNameKey(displayName) {
  return sanitizePlayerName(displayName)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .slice(0, 40);
}

function normaliseRow(data, docId = '') {
  return {
    uid: String(data.uid || ''),
    name: sanitizePlayerName(data.displayName || docId || 'Player') || 'Player',
    totalBanked: Number(data.totalBanked || 0),
    bestHeist: Number(data.bestHeist || 0),
    heistsPlayed: Number(data.heistsPlayed || 0),
    paintingsStolen: Number(data.paintingsStolen || 0),
    updatedAtMs: Number(data.updatedAtMs || 0)
  };
}

export async function isUsernameAvailable(displayName) {
  const cleanName = sanitizePlayerName(displayName);
  if (!cleanName) return false;

  await ensureAnonymousAuth();
  const key = buildNameKey(cleanName);
  const usernameRef = doc(db, 'usernames', key);
  const snap = await getDoc(usernameRef);
  return !snap.exists();
}

export async function reserveUsername(displayName) {
  const cleanName = sanitizePlayerName(displayName);
  if (!cleanName) return { ok: false, reason: 'invalid_name' };

  const user = await ensureAnonymousAuth();
  if (!user?.uid) return { ok: false, reason: 'auth_failed' };

  const key = buildNameKey(cleanName);
  const usernameRef = doc(db, 'usernames', key);

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(usernameRef);
      if (snap.exists()) throw new Error('username_taken');
      transaction.set(usernameRef, {
        uid: user.uid,
        displayName: cleanName,
        nameKey: key,
        createdAt: serverTimestamp(),
        updatedAtMs: Date.now()
      });
    });
    return { ok: true, nameKey: key, displayName: cleanName };
  } catch (err) {
    if (err?.message === 'username_taken') return { ok: false, reason: 'username_taken' };
    console.error('Username reservation failed:', err);
    return { ok: false, reason: 'reservation_failed' };
  }
}

export async function fetchUnifiedLeaderboardRows() {
  const leaderboardRef = collection(db, 'leaderboard');
  const q = query(leaderboardRef, orderBy('totalBanked', 'desc'), limit(100));
  const snap = await getDocs(q);

  const rows = snap.docs
    .map((docSnap) => normaliseRow(docSnap.data(), docSnap.id))
    .filter((row) => row.totalBanked > 0 || row.bestHeist > 0);

  rows.sort((a, b) => {
    if (b.totalBanked !== a.totalBanked) return b.totalBanked - a.totalBanked;
    if (b.bestHeist !== a.bestHeist) return b.bestHeist - a.bestHeist;
    if (b.heistsPlayed !== a.heistsPlayed) return b.heistsPlayed - a.heistsPlayed;
    return a.name.localeCompare(b.name);
  });

  return rows.map((row, index) => ({ rank: index + 1, ...row }));
}

export async function submitCurrentPlayerLeaderboard() {
  const user = await ensureAnonymousAuth();
  if (!user?.uid) return;

  const save = loadSave();
  const displayName = sanitizePlayerName(getActiveProfileName());
  if (!displayName) return;

  if (
    Number(save.totalBanked || 0) <= 0 &&
    Number(save.bestHeist || 0) <= 0 &&
    Number(save.heistsPlayed || 0) <= 0 &&
    Number(save.paintingsStolen || 0) <= 0
  ) {
    return;
  }

  const nameKey = buildNameKey(displayName);
  const playerRef = doc(db, 'leaderboard', nameKey);
  const usernameRef = doc(db, 'usernames', nameKey);

  await setDoc(usernameRef, {
    uid: user.uid,
    displayName,
    nameKey,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  }, { merge: true });

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(playerRef);
    const prev = snap.exists() ? snap.data() : {};

    transaction.set(
      playerRef,
      {
        uid: user.uid,
        nameKey,
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
  window.nanaHeistReserveUsername = reserveUsername;
  window.nanaHeistIsUsernameAvailable = isUsernameAvailable;

  let submitTimer = null;

  const scheduleSubmit = () => {
    clearTimeout(submitTimer);
    submitTimer = setTimeout(() => {
      submitCurrentPlayerLeaderboard().catch((err) => {
        console.error('Leaderboard submit failed:', err);
      });
    }, 350);
  };

  ensureAnonymousAuth().catch((err) => {
    console.error('Anonymous auth bootstrap failed:', err);
  });

  window.addEventListener('nanaheist:data-updated', scheduleSubmit);
  window.addEventListener('nanaheist:settings-updated', scheduleSubmit);

  scheduleSubmit();
}
