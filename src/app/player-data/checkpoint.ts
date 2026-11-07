import { computed, inject, Service, signal } from '@angular/core';
import { unlockedCheckpoints } from '../game/modes/checkpoints';
import { reachedPlace } from './run';
import { RunStore } from './run-store';

/**
 * The place the next game starts from, picked on the main menu: the start of π, place 0, or a checkpoint the
 * player has unlocked. Checkpoints aren't kept: they're worked out from the runs, every checked run unlocking those up
 * to the place it reached, whatever its game mode.
 */
@Service()
export class Checkpoint {
  private readonly store = inject(RunStore);
  /** The checkpoints unlocked, in order. */
  readonly unlocked = signal<readonly number[]>([]);
  private readonly picked = signal(0);
  /** The place picked, if it's still unlocked, or the start of π. */
  readonly start = computed(() => (this.unlocked().includes(this.picked()) ? this.picked() : 0));

  /** Works out the checkpoints unlocked again, from the runs as they are now. */
  async refresh(): Promise<void> {
    const runs = await this.store.runs();
    this.unlocked.set(unlockedCheckpoints(runs.filter((run) => run.checked).map(reachedPlace)));
  }

  /** Picks the place the next games start from. */
  pick(place: number): void {
    this.picked.set(place);
  }
}
