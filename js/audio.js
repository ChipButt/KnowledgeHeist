import { loadSettings } from './storage.js';
import { getVolumeScale } from './settings.js';

const backgroundMusicTracks = [
  'Gallery of Era.mp3',
  'Gallery of Eras.mp3',
  'Gallery of Golden Years long.mp3',
  'Gallery of Golden Years.mp3',
  'Gallery Relax Machine.mp3',
  'Gallery Time Machine.mp3'
];

const MAX_MANAGED_GAIN = 2.2;
const VOICE_BOOST = 1.9;
const SIREN_BOOST = 1.15;

let lastBackgroundMusicTrack = '';
let sharedAudioContext = null;
let autoUnlockBound = false;

const managedAudioMap = new WeakMap();

const nativeVolumeDescriptor =
  typeof HTMLMediaElement !== 'undefined'
    ? Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume')
    : null;

function clampManagedVolume(value) {
  return Math.max(0, Math.min(MAX_MANAGED_GAIN, Number(value) || 0));
}

function clampMediaVolume(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function setNativeVolume(audio, value) {
  if (!nativeVolumeDescriptor?.set) return;

  try {
    nativeVolumeDescriptor.set.call(audio, clampMediaVolume(value));
  } catch (_) {}
}

function getAudioContext() {
  if (sharedAudioContext) return sharedAudioContext;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  sharedAudioContext = new AudioContextClass();
  bindAutoUnlock();
  return sharedAudioContext;
}

function bindAutoUnlock() {
  if (autoUnlockBound) return;
  autoUnlockBound = true;

  const resume = () => {
    unlockAudioContext();
  };

  window.addEventListener('pointerdown', resume, { passive: true });
  window.addEventListener('touchend', resume, { passive: true });
  window.addEventListener('keydown', resume);
}

export function unlockAudioContext() {
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve();
  if (ctx.state === 'running') return Promise.resolve();

  try {
    return ctx.resume().catch(() => {});
  } catch (_) {
    return Promise.resolve();
  }
}

function ensureManagedAudio(audio, initialVolume = 1) {
  const existing = managedAudioMap.get(audio);
  if (existing) return existing;

  audio.preload = 'auto';
  audio.muted = false;

  try {
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
  } catch (_) {}

  const entry = {
    audio,
    volume: clampManagedVolume(initialVolume),
    ctx: null,
    source: null,
    gain: null,
    useGain: false
  };

  const ctx = getAudioContext();

  if (ctx) {
    try {
      entry.ctx = ctx;
      entry.source = ctx.createMediaElementSource(audio);
      entry.gain = ctx.createGain();
      entry.source.connect(entry.gain);
      entry.gain.connect(ctx.destination);
      entry.useGain = true;
    } catch (_) {
      entry.useGain = false;
    }
  }

  managedAudioMap.set(audio, entry);
  applyManagedVolume(audio, entry.volume);

  audio.addEventListener('play', () => {
    unlockAudioContext();
  });

  return entry;
}

function applyManagedVolume(audio, value) {
  const entry = ensureManagedAudio(audio, value);
  entry.volume = clampManagedVolume(value);

  if (entry.useGain && entry.gain && entry.ctx) {
    try {
      entry.gain.gain.setValueAtTime(entry.volume, entry.ctx.currentTime);
    } catch (_) {
      entry.gain.gain.value = entry.volume;
    }

    setNativeVolume(audio, 1);
    return;
  }

  setNativeVolume(audio, entry.volume);
}

export function setAudioVolume(audio, volume) {
  if (!audio) return;
  applyManagedVolume(audio, volume);
}

function getNextBackgroundMusicTrack() {
  const availableTracks = backgroundMusicTracks.filter(
    (track) => track !== lastBackgroundMusicTrack
  );

  const nextTrack =
    availableTracks[Math.floor(Math.random() * availableTracks.length)];

  lastBackgroundMusicTrack = nextTrack;
  return nextTrack;
}

export function createAudio(src, volume = 0.5, loop = false) {
  const audio = new Audio(src);
  audio.loop = loop;
  ensureManagedAudio(audio, volume);
  return audio;
}

export function pauseAudio(audio) {
  if (!audio) return;

  try {
    audio.pause();
  } catch (_) {}
}

export function stopAudio(audio) {
  if (!audio) return;

  try {
    audio.pause();
    audio.currentTime = 0;
  } catch (_) {}
}

export function safePlayAudio(audio, volume) {
  if (!audio) return;

  if (volume !== undefined && volume !== null) {
    setAudioVolume(audio, volume);
  }

  Promise.resolve(unlockAudioContext()).finally(() => {
    try {
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {}
  });
}

export function safeResumeAudio(audio, volume) {
  if (!audio) return;
  safePlayAudio(audio, volume);
}

export function safeRestartAudio(audio, volume) {
  if (!audio) return;

  try {
    audio.pause();
    audio.currentTime = 0;
  } catch (_) {}

  safePlayAudio(audio, volume);
}

export function createBackgroundMusic() {
  const settings = loadSettings();
  const audio = createAudio(
    getNextBackgroundMusicTrack(),
    getVolumeScale(settings.gameMusicVolume),
    false
  );

  audio.addEventListener('ended', () => {
    audio.src = getNextBackgroundMusicTrack();
    audio.load();
    safeRestartAudio(audio, getVolumeScale(loadSettings().gameMusicVolume));
  });

  return audio;
}

export function getBoostedVoiceVolumeScale() {
  return getVolumeScale(loadSettings().voiceVolume) * VOICE_BOOST;
}

export function applyGameAudioSettings(assets) {
  const settings = loadSettings();
  const gameMusicVolume = getVolumeScale(settings.gameMusicVolume);
  const voiceVolume = getVolumeScale(settings.voiceVolume) * VOICE_BOOST;
  const sirenVolume = getVolumeScale(settings.voiceVolume) * SIREN_BOOST;

  if (assets.backgroundMusic) setAudioVolume(assets.backgroundMusic, gameMusicVolume);
  if (assets.sirenSound) setAudioVolume(assets.sirenSound, sirenVolume);
  if (assets.withMeSound) setAudioVolume(assets.withMeSound, voiceVolume);
  if (assets.heyStopSound) setAudioVolume(assets.heyStopSound, voiceVolume);
  if (assets.chaChingSound) setAudioVolume(assets.chaChingSound, voiceVolume);
}

export function createFailVoiceAudio(file) {
  return createAudio(file, getBoostedVoiceVolumeScale(), false);
}
