import { GAME_VALUES } from '../../game-values';

/** The struck tones a milestone sound plays, each its partials: see {@link TIMBRES}. */
export type Timbre = 'kalimba' | 'tine' | 'glock' | 'musicBox' | 'harp';

/**
 * Each timbre's partials, as `[ratio, level, ring]`: its frequency as a ratio of the note's, its level, the loudest at
 * 1, and how long it rings, as a share of the note's length. Higher partials ring shorter, as a struck tone's do.
 */
export const TIMBRES: Readonly<Record<Timbre, readonly (readonly [number, number, number])[]>> = {
  // The keys' own plain pluck.
  kalimba: [
    [1, 1, 1],
    [2, 0.12, 0.6],
    [3, 0.02, 0.4],
  ],
  // Brighter, with a metal tick.
  tine: [
    [1, 1, 1],
    [2, 0.3, 0.5],
    [3, 0.08, 0.3],
    [4.2, 0.05, 0.15],
    [7.1, 0.03, 0.05],
  ],
  glock: [
    [1, 1, 1],
    [2.76, 0.35, 0.35],
    [5.4, 0.14, 0.2],
    [8.93, 0.07, 0.12],
  ],
  musicBox: [
    [1, 1, 1],
    [2, 0.2, 0.5],
    [3.98, 0.25, 0.3],
    [6.1, 0.1, 0.15],
  ],
  harp: [
    [1, 1, 1],
    [2, 0.5, 0.6],
    [3, 0.25, 0.45],
    [4, 0.12, 0.35],
    [5, 0.06, 0.3],
  ],
};

/** What a milestone sound plays its notes on, each at a time in seconds from its start, its pitch a MIDI note number. */
export interface Instruments {
  /** Strikes a note that rings for `length` seconds, at `gain`, the loudest at 1. */
  pluck(timbre: Timbre, pitch: number, at: number, length: number, gain: number): void;
  /** Swells a soft chord over `attack`, holds it, and lets it go over `release`, in seconds: the air round a note. */
  air(
    pitches: readonly number[],
    at: number,
    attack: number,
    hold: number,
    release: number,
    gain: number,
  ): void;
}

/** Strikes notes one after another, `gap` seconds apart, low to high, as a strum. */
function roll(
  play: Instruments,
  timbre: Timbre,
  pitches: readonly number[],
  at: number,
  length: number,
  gain: number,
  gap = 0.018,
): void {
  pitches.forEach((pitch, i) => {
    play.pluck(timbre, pitch, at + i * gap, length, gain);
  });
}

/**
 * A sound celebrating a milestone, in two versions that go together: the first time it's ever reached, notes leading to
 * a big one, whose sound is there in them from the start; and every other time, its summary, its last two moves, short
 * and lighter, not to flood the player as they come back to it.
 */
export interface MilestoneSound {
  readonly id: string;
  readonly label: string;
  readonly first: (play: Instruments) => void;
  readonly again: (play: Instruments) => void;
}

/** The milestone sounds, the game's own first. */
const SOUNDS: readonly MilestoneSound[] = [
  {
    id: 'musicBox',
    label: 'Music Box',
    // Kalimba doubled by a music box an octave up all the way through; the big note shivers on, softer and softer.
    first: (play) => {
      [72, 76, 79].forEach((pitch, i) => {
        play.pluck('kalimba', pitch, i * 0.14, 0.7, 0.2);
        play.pluck('musicBox', pitch + 12, i * 0.14, 0.7, 0.1);
      });
      const big = 0.42;
      play.pluck('kalimba', 84, big, 2.4, 0.3);
      play.pluck('musicBox', 96, big, 1.8, 0.14);
      for (let k = 1; k <= 5; k++) {
        play.pluck('musicBox', 96, big + k * 0.095, 0.6, 0.1 * 0.7 ** k);
      }
    },
    again: (play) => {
      play.pluck('musicBox', 91, 0, 0.5, 0.1);
      play.pluck('kalimba', 79, 0, 0.5, 0.1);
      play.pluck('musicBox', 96, 0.1, 0.9, 0.13);
      play.pluck('kalimba', 84, 0.1, 1.1, 0.2);
    },
  },
  {
    id: 'kalimbaRise',
    label: 'Kalimba Rise',
    // Each note leading on carries a faint glockenspiel sparkle, an octave up: the big note's shine from the first.
    first: (play) => {
      [76, 79, 83].forEach((pitch, i) => {
        play.pluck('kalimba', pitch, i * 0.16, 0.8, 0.28);
        play.pluck('glock', pitch + 12, i * 0.16, 0.5, 0.025 + i * 0.01);
      });
      const big = 0.48;
      play.pluck('kalimba', 88, big, 2.6, 0.36);
      play.pluck('kalimba', 76, big, 1.6, 0.16);
      play.pluck('glock', 100, big, 1.6, 0.06);
      play.air([64, 71, 76], big, 0.05, 0.6, 1.8, 0.035);
    },
    again: (play) => {
      play.pluck('kalimba', 83, 0, 0.6, 0.18);
      play.pluck('glock', 95, 0, 0.3, 0.015);
      play.pluck('kalimba', 88, 0.12, 1.2, 0.24);
      play.pluck('glock', 100, 0.12, 0.7, 0.035);
    },
  },
  {
    id: 'accelerando',
    label: 'Accelerando',
    // The notes leading on come closer and closer, as the wave speeds up, and land on the big note over its fifth.
    first: (play) => {
      (
        [
          [72, 0],
          [74, 0.2],
          [76, 0.34],
          [79, 0.44],
        ] as const
      ).forEach(([pitch, at], i) => {
        play.pluck('kalimba', pitch, at, 0.7, 0.22 + i * 0.03);
        play.pluck('glock', pitch + 24, at, 0.3, 0.012 + i * 0.006);
      });
      const big = 0.5;
      play.pluck('kalimba', 84, big, 2.6, 0.36);
      play.pluck('kalimba', 79, big, 1.8, 0.16);
      play.pluck('kalimba', 60, big, 1.6, 0.14);
      play.pluck('glock', 96, big, 1.4, 0.05);
      play.air([60, 67, 72], big, 0.05, 0.5, 1.8, 0.03);
    },
    again: (play) => {
      play.pluck('kalimba', 79, 0, 0.5, 0.16);
      play.pluck('kalimba', 84, 0.09, 1.2, 0.24);
      play.pluck('glock', 96, 0.09, 0.6, 0.03);
    },
  },
  {
    id: 'strum',
    label: 'Strum',
    // Each note leading on a little strum of two, the big note a full one, kalimba and harp: the same gesture, grown.
    first: (play) => {
      [
        [67, 74],
        [69, 76],
        [71, 79],
      ].forEach((pitches, i) => {
        roll(play, 'kalimba', pitches, i * 0.15, 0.7, 0.18);
        roll(play, 'harp', pitches, i * 0.15, 0.5, 0.05);
      });
      const big = 0.45;
      roll(play, 'kalimba', [60, 67, 72, 76, 79, 84], big, 2.4, 0.16, 0.022);
      roll(play, 'harp', [72, 76, 79, 84], big, 1.8, 0.06, 0.022);
      play.air([60, 67, 76], big, 0.08, 0.5, 1.8, 0.03);
    },
    again: (play) => {
      roll(play, 'kalimba', [71, 79], 0, 0.5, 0.14);
      roll(play, 'kalimba', [72, 76, 79, 84], 0.11, 1.1, 0.13, 0.02);
    },
  },
  {
    id: 'resolution',
    label: 'Resolution',
    // The notes leading on hang on a suspended chord, and the big note resolves it to a bright major.
    first: (play) => {
      [74, 79, 84].forEach((pitch, i) => {
        play.pluck('kalimba', pitch, i * 0.17, 0.9, 0.26);
        play.pluck('kalimba', pitch - 12, i * 0.17, 0.6, 0.06);
      });
      play.air([62, 67, 72], 0, 0.3, 0.1, 0.3, 0.02);
      const big = 0.51;
      roll(play, 'kalimba', [55, 71, 74, 79, 83], big, 2.6, 0.2, 0.015);
      play.pluck('glock', 95, big, 1.6, 0.05);
      play.air([55, 62, 71, 74], big, 0.06, 0.6, 1.8, 0.035);
    },
    again: (play) => {
      play.pluck('kalimba', 84, 0, 0.5, 0.18);
      roll(play, 'kalimba', [71, 79, 83], 0.13, 1.2, 0.17, 0.015);
    },
  },
  {
    id: 'deepTines',
    label: 'Deep Tines',
    // Bright tines over a deep note under each note leading on, which the big note answers two octaves down.
    first: (play) => {
      [81, 85, 88].forEach((pitch, i) => {
        play.pluck('tine', pitch, i * 0.16, 0.8, 0.22);
        play.pluck('kalimba', 57, i * 0.16, 0.6, 0.07 + i * 0.02);
      });
      const big = 0.48;
      play.pluck('tine', 93, big, 2.6, 0.3);
      play.pluck('kalimba', 57, big, 2.2, 0.3);
      play.pluck('kalimba', 76, big, 1.6, 0.12);
      play.air([45, 57, 64], big, 0.06, 0.5, 1.8, 0.04);
    },
    again: (play) => {
      play.pluck('tine', 88, 0, 0.5, 0.15);
      play.pluck('kalimba', 57, 0.12, 1, 0.16);
      play.pluck('tine', 93, 0.12, 1.1, 0.2);
    },
  },
  {
    id: 'swing',
    label: 'Swing',
    // A lilting long-short rhythm, the last note leading on jumping up before the big note settles a fourth higher.
    first: (play) => {
      (
        [
          [72, 0],
          [69, 0.13],
          [72, 0.25],
        ] as const
      ).forEach(([pitch, at]) => {
        play.pluck('kalimba', pitch, at, 0.7, 0.24);
        play.pluck('glock', pitch + 12, at, 0.3, 0.015);
      });
      const big = 0.38;
      play.pluck('kalimba', 77, big, 2.6, 0.34);
      roll(play, 'kalimba', [65, 69, 72], big, 1.8, 0.1, 0.02);
      play.pluck('glock', 89, big, 1.4, 0.05);
      play.air([53, 65, 72], big, 0.05, 0.5, 1.7, 0.03);
    },
    again: (play) => {
      play.pluck('kalimba', 72, 0, 0.45, 0.16);
      play.pluck('kalimba', 77, 0.12, 1.2, 0.24);
      play.pluck('glock', 89, 0.12, 0.6, 0.03);
    },
  },
  {
    id: 'climb',
    label: 'Climb',
    // Five notes climbing a pentatonic scale, faster and faster, the big note an octave above the first.
    first: (play) => {
      (
        [
          [72, 0],
          [74, 0.17],
          [76, 0.31],
          [79, 0.43],
          [81, 0.54],
        ] as const
      ).forEach(([pitch, at], i) => {
        play.pluck('kalimba', pitch, at, 0.6, 0.18 + i * 0.025);
        play.pluck('glock', pitch + 12, at, 0.3, 0.008 + i * 0.006);
      });
      const big = 0.64;
      play.pluck('kalimba', 84, big, 2.6, 0.36);
      play.pluck('kalimba', 72, big, 1.6, 0.14);
      play.pluck('glock', 96, big, 1.6, 0.06);
      play.air([60, 67, 76], big, 0.05, 0.5, 1.8, 0.035);
    },
    again: (play) => {
      play.pluck('kalimba', 81, 0, 0.45, 0.15);
      play.pluck('kalimba', 84, 0.08, 1.2, 0.24);
      play.pluck('glock', 96, 0.08, 0.6, 0.03);
    },
  },
];

/** The id of the game's own milestone sound. */
export const MILESTONE_SOUND: string = GAME_VALUES.milestoneSound;

/** The milestone sounds, the game's own first, the others in the order they were made. */
export const MILESTONE_SOUNDS: readonly MilestoneSound[] = [
  ...SOUNDS.filter((sound) => sound.id === MILESTONE_SOUND),
  ...SOUNDS.filter((sound) => sound.id !== MILESTONE_SOUND),
];

/** The milestone sound with an id, if any. */
export function milestoneSoundById(id: unknown): MilestoneSound | undefined {
  return SOUNDS.find((sound) => sound.id === id);
}
