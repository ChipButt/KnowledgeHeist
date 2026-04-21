import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

import {
  buildCloudProfilePayload,
  clearCloudProfile,
  getActiveProfileName,
  hydrateCloudProfile,
  loadSave
} from './storage.js';
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

let currentUser = null;
let authReady = false;
let cloudWriteTimer = null;

function buildNameKey(displayName) {
  return sanitizePlayerName(displayName)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .slice(0, 40);
}

function dispatchAuthState(detail) {
  window.dispatchEvent(new CustomEvent('nanaheist:auth-state', { detail }));
}

function normaliseRow(data) {
  return {
    uid: String(data.uid || ''),
    name: sanitizePlayerName(data.displayName || 'Player') || 'Player',
    totalBanked: Number(data.totalBanked || 0),
    bestHeist: Number(data.bestHeist || 0),
    heistsPlayed: Number(data.heistsPlayed || 0),
    paintingsStolen: Number(data.paintingsStolen || 0),
    updatedAtMs: Number(data.updatedAtMs || 0)
  };
}

async function loadProfileForUser(user) {
  const profileRef = doc(db, 'profiles', user.uid);
  const snap = await getDoc(profileRef);

  if (!snap.exists()) {
    clearCloudProfile();
    dispatchAuthState({
      ready: true,
      loggedIn: false,
      profileName: '',
      error: 'No profile found for this account.'
    });
    await signOut(auth);
    return;
  }

  const data = snap.data();
  hydrateCloudProfile({
    displayName: data.displayName || '',
    save: data.save || {},
    settings: data.settings || {},
    history: data.history || [],
    lastHeistWrong: data.lastHeistWrong || []
  });

  dispatchAuthState({
    ready: true,
    loggedIn: true,
    profileName: String(data.displayName || '')
  });
}

export async function createAccountWithEmail({ displayName, email, password }) {
  const cleanName = sanitizePlayerName(displayName);
  if (!cleanName) return { ok: false, reason: 'invalid_name' };
  if (!email || !password) return { ok: false, reason: 'missing_credentials' };

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  const nameKey = buildNameKey(cleanName);

  try {
    await runTransaction(db, async (transaction) => {
      const usernameRef = doc(db, 'usernames', nameKey);
      const usernameSnap = await transaction.get(usernameRef);

      if (usernameSnap.exists()) {
        throw new Error('username_taken');
      }

      transaction.set(usernameRef, {
        uid: user.uid,
        displayName: cleanName,
        nameKey,
        createdAt: serverTimestamp(),
        updatedAtMs: Date.now()
      });

      transaction.set(doc(db, 'profiles', user.uid), {
        uid: user.uid,
        displayName: cleanName,
        nameKey,
        createdAt: serverTimestamp(),
        lastPlayedAt: serverTimestamp(),
        save: {
          totalBanked: 0,
          bestHeist: 0,
          heistsPlayed: 0,
          paintingsStolen: 0,
          usedQuestionIds: []
        },
        settings: {
          playerName: cleanName,
          hubVolume: 22,
          gameMusicVolume: 22,
          voiceVolume: 90,
          difficulty: 'medium'
        },
        history: [],
        lastHeistWrong: []
      });

      transaction.set(doc(db, 'leaderboard', user.uid), {
        uid: user.uid,
        displayName: cleanName,
        nameKey,
        totalBanked: 0,
        bestHeist: 0,
        heistsPlayed: 0,
        paintingsStolen: 0,
        updatedAt: serverTimestamp(),
        updatedAtMs: Date.now()
      });
    });

    await loadProfileForUser(user);
    return { ok: true };
  } catch (err) {
    if (err?.message === 'username_taken') {
      await signOut(auth);
      return { ok: false, reason: 'username_taken' };
    }
    console.error('Account creation failed:', err);
    await signOut(auth);
    return { ok: false, reason: 'create_failed' };
  }
}

export async function loginWithEmail({ email, password }) {
  if (!email || !password) return { ok: false, reason: 'missing_credentials' };

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await loadProfileForUser(cred.user);
    return { ok: true };
  } catch (err) {
    console.error('Login failed:', err);
    return { ok: false, reason: 'login_failed' };
  }
}

export async function logoutUser() {
  await signOut(auth);
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

  return rows.map((row, index) => ({ rank: index + 1, ...row }));
}

export async function submitCurrentPlayerLeaderboard() {
  if (!currentUser?.uid) return;

  const save = loadSave();
  const displayName = sanitizePlayerName(getActiveProfileName());
  if (!displayName) return;

  const nameKey = buildNameKey(displayName);
  const profilePayload = buildCloudProfilePayload();

  await setDoc(doc(db, 'profiles', currentUser.uid), {
    uid: currentUser.uid,
    displayName,
    nameKey,
    lastPlayedAt: serverTimestamp(),
    ...profilePayload
  }, { merge: true });

  await setDoc(doc(db, 'leaderboard', currentUser.uid), {
    uid: currentUser.uid,
    displayName,
    nameKey,
    totalBanked: Number(save.totalBanked || 0),
    bestHeist: Number(save.bestHeist || 0),
    heistsPlayed: Number(save.heistsPlayed || 0),
    paintingsStolen: Number(save.paintingsStolen || 0),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  }, { merge: true });
}

function queueCloudWrite() {
  clearTimeout(cloudWriteTimer);
  cloudWriteTimer = setTimeout(() => {
    submitCurrentPlayerLeaderboard().catch((err) => {
      console.error('Leaderboard submit failed:', err);
    });
  }, 300);
}

export async function initCloudAuthBridge() {
  await setPersistence(auth, browserLocalPersistence);

  window.nanaHeistUnifiedLeaderboardProvider = fetchUnifiedLeaderboardRows;
  window.nanaHeistQueueCloudWrite = queueCloudWrite;

  dispatchAuthState({
    ready: false,
    loggedIn: false,
    profileName: '',
    loading: true
  });

  onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    authReady = true;

    if (!user) {
      clearCloudProfile();
      dispatchAuthState({
        ready: true,
        loggedIn: false,
        profileName: ''
      });
      return;
    }

    try {
      await loadProfileForUser(user);
    } catch (err) {
      console.error('Profile load failed:', err);
      clearCloudProfile();
      dispatchAuthState({
        ready: true,
        loggedIn: false,
        profileName: '',
        error: 'Could not load your profile.'
      });
    }
  });
}

export function isAuthReady() {
  return authReady;
}
