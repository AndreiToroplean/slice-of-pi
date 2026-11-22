import { inject, Service, signal } from '@angular/core';
import { Tweaks } from '../../developer-mode/tweaks';
import { Speaker } from '../speaker';
import { audioInstruments } from './audio-instruments';
import { MILESTONE_SOUNDS, milestoneSoundById } from './milestone-sounds';
import { MilestoneWave } from './milestone-wave';

/** A milestone being celebrated: whether for the first time, in which color, its wave, and since when, in ms. */
export interface Celebrating {
  readonly first: boolean;
  /** As `#rrggbb`. */
  readonly color: string;
  readonly wave: MilestoneWave;
  /** On the clock of `performance.now()`, as animation frames tell the time. */
  readonly since: number;
}

/**
 * Celebrates the milestones a run reaches, over whatever screen shows: a sound, and a wave of the milestone's color up
 * the screen's edges, the first time it's ever reached a longer one, fading out, and every other time its short
 * summary. The wave is drawn by the celebration layer, over every screen.
 */
@Service()
export class Celebration {
  private readonly speaker = inject(Speaker);
  private readonly tweaks = inject(Tweaks);
  private readonly shown = signal<Celebrating | undefined>(undefined);

  /** The celebration under way, if any. */
  readonly celebrating = this.shown.asReadonly();

  /**
   * Celebrates a milestone in its `color`, for the `first` time ever or again, its wave and, if `sounding`, its sound
   * together.
   */
  celebrate(first: boolean, color: string, sounding = true): void {
    const sound = milestoneSoundById(this.tweaks.milestoneSound()) ?? MILESTONE_SOUNDS[0];
    if (sounding && sound !== undefined) {
      this.speaker.perform((context, output, start) => {
        const play = audioInstruments(context, output, start);
        if (first) {
          sound.first(play);
        } else {
          sound.again(play);
        }
      });
    }
    this.shown.set({
      first,
      color,
      wave: first ? this.tweaks.firstMilestoneWave() : this.tweaks.milestoneWave(),
      since: performance.now(),
    });
  }

  /** Ends a celebration once its wave is over, unless another took its place. */
  end(celebrating: Celebrating): void {
    if (this.shown() === celebrating) {
      this.shown.set(undefined);
    }
  }
}
