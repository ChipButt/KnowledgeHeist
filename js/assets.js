import { createAudio, createBackgroundMusic } from './audio.js';

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function loadSeq(prefix, count) {
  return Array.from({ length: count }, (_, i) => loadImage(`${prefix}${i}_delay-0.2s.png`));
}

export function createAssets() {
  const assets = {
    backgroundMusic: null,
    roomBackground: loadImage('museum-room.png'),

    chaChingSound: createAudio('ChaChing.mp3', 0.9, false),
    sirenSound: createAudio('Siren.mp3', 0.55, true),
    withMeSound: createAudio('WithMe.mp3', 0.95, false),
    heyStopSound: createAudio('Hey!Stop.mp3', 0.95, false),

    failVoiceFiles: [
      'Didntwantthat.mp3',
      'GottaGetThemRight.mp3',
      'IllGetTheNext.mp3',
      'NextTime.mp3'
    ],

    walkAnimations: {
      south: loadSeq('Nana South Walking_', 6),
      'south-east': loadSeq('Nana South-East Walking_', 6),
      east: loadSeq('Nana East Walking_', 6),
      'north-east': loadSeq('Nana North-East Walking_', 6),
      north: loadSeq('Nana North Walking_', 6),
      'north-west': loadSeq('Nana North-West Walking_', 6),
      west: loadSeq('Nana West Walking_', 6),
      'south-west': loadSeq('Nana South-West Walking_', 6)
    },

    pullAnimations: {
      east: loadSeq('Nana East Pull_', 6),
      north: loadSeq('Nana North Pull_', 6),
      west: loadSeq('Nana West Pull_', 6)
    },

    guardRunAnimations: {
      east: loadSeq('Security Guard East Running_', 6),
      west: loadSeq('Security Guard West Running_', 6),
      north: loadSeq('Security Guard North Running_', 6),
      south: loadSeq('Security Guard South Running_', 6),
      'north-east': loadSeq('Security Guard North-East Running_', 6),
      'north-west': loadSeq('Security Guard North-West Running_', 6),
      'south-east': loadSeq('Security Guard South-East Running_', 6),
      'south-west': loadSeq('Security Guard South-West Running_', 6)
    },

    guardWalkAnimations: {
      south: loadSeq('Security Guard South Walking_', 6),
      'south-east': loadSeq('Security Guard South-East Walking_', 6),
      'south-west': loadSeq('Security Guard South-West Walking_', 6)
    },

    artImages: {
      northA: loadImage('painting_abstract_small.png'),
      northB: loadImage('painting_mona_lisa_large.png'),
      northC: loadImage('painting_starry_night.png'),
      westA: loadImage('painting_landscape_left_angle.png'),
      westB: loadImage('painting_portrait_left_lower_angle.png'),
      westC: loadImage('painting_portrait_left_lower_angle_2.png'),
      westD: loadImage('painting_portrait_left_lower_angle_3.png'),
      eastA: loadImage('painting_portrait_right_angle.png'),
      eastB: loadImage('painting_mona_lisa_right_lower_angle.png'),
      aboard: loadImage('A-Board_Art_Piece.png'),
      pedestal: loadImage('statue_on_pedestal.png')
    }
  };

  assets.backgroundMusic = createBackgroundMusic();
  return assets;
}
