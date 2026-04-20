import { loadSettings } from './storage.js';
import { getVolumeScale } from './settings.js';

export function createAudio(src, volume = 0.5, loop = false) {
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.volume = volume;
  audio.loop = loop;
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
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) {}
}

const backgroundMusicTracks = [
  'Gallery of Era.mp3',
  'Gallery of Eras.mp3',
  'Gallery of Golden Years long.mp3',
  'Gallery of Golden Years.mp3',
  'Gallery Relax Machine.mp3',
  'Gallery Time Machine.mp3'
];

let lastBackgroundMusicTrack = '';

function getNextBackgroundMusicTrack() {
  const availableTracks = backgroundMusicTracks.filter(
    (track) => track !== lastBackgroundMusicTrack
  );

  const nextTrack =
    availableTracks[Math.floor(Math.random() * availableTracks.length)];

  lastBackgroundMusicTrack = nextTrack;
  return nextTrack;
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
