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

let lastBackgroundMusicTrack = '';
let sharedAudioContext = null;
let autoUnlockBound = false;

const mediaNodes = new WeakMap();

const nativeVolumeDescriptor =
  typeof HTMLMediaElement !== 'undefined'
    ? Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume')
    : null;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
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

function setNativeVolume(audio, value) {
  if (!nativeVolumeDescriptor?.set) return;
  try {
    nativeVolumeDescriptor.set.call(audio, value);
  } catch (_) {}
}

function patchAudioForMobileVolume(audio, initialVolume) {
  const ctx = getAudioContext();

  if (!ctx) {
    setNativeVolume(audio, clamp01(initialVolume));
    return audio;
  }

  if (mediaNodes.has(audio)) {
    const existing = mediaNodes.get(audio);
    existing.setVolume(initialVolume);
    return audio;
  }

  const sourceNode = ctx.createMediaElementSource(audio);
  const gainNode = ctx.createGain();

  sourceNode.connect(gainNode);
  gainNode.connect(ctx.destination);

  let logicalVolume = clamp01(initialVolume);

  const setVolume = (value) => {
    logicalVolume = clamp01(value);
    gainNode.gain.value = logicalVolume;

    // Keep the underlying media element fully open so the gain node does the real work.
    setNativeVolume(audio, 1);
  };

  setVolume(logicalVolume);

  mediaNodes.set(audio, {
    sourceNode,
    gainNode,
    setVolume
  });

  try {
    Object.defineProperty(audio, 'volume', {
      configurable: true,
      enumerable: true,
      get() {
        return logicalVolume;
      },
      set(value) {
        setVolume(value);
      }
    });
  } catch (_) {
    // Fallback: desktop/native volume still works where supported.
    setNativeVolume(audio, logicalVolume);
  }

  audio.addEventListener('play', () => {
    unlockAudioContext();
  });

  return audio;
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
  audio.preload = 'auto';
  audio.loop = loop;

  patchAudioForMobileVolume(audio, volume);
  return audio;
}

export function stopAudio(audio) {
  if (!audio) return;

  try {
    audio.pause();
    audio.currentTime = 0;
  } catch (_) {}
}

export function safeRestartAudio(audio, volume = 1) {
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;

    unlockAudioContext();

    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) {}
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

export function applyGameAudioSettings(assets) {
  const settings = loadSettings();
  const gameMusicVolume = getVolumeScale(settings.gameMusicVolume);
  const voiceVolume = getVolumeScale(settings.voiceVolume);

  if (assets.backgroundMusic) assets.backgroundMusic.volume = gameMusicVolume;
  if (assets.sirenSound) assets.sirenSound.volume = Math.min(1, voiceVolume * 0.62);
  if (assets.withMeSound) assets.withMeSound.volume = Math.min(1, voiceVolume * 1.0);
  if (assets.heyStopSound) assets.heyStopSound.volume = Math.min(1, voiceVolume * 1.0);
  if (assets.chaChingSound) assets.chaChingSound.volume = Math.min(1, voiceVolume * 1.0);
}

export function createFailVoiceAudio(file) {
  const settings = loadSettings();
  return createAudio(file, getVolumeScale(settings.voiceVolume), false);
}
