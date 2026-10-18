import { Service, signal } from '@angular/core';
import type { BreakModelKind } from '../../game/grouping/break-models/break-model';

/**
 * Which hyperparameters of each break model developer mode keeps where they are when fitting it to the player's groups:
 * only while the app is open, never saved.
 */
@Service()
export class PinnedHyperparameters {
  /** The keys pinned, by the id of the break model. */
  private readonly pinned = signal<Readonly<Record<string, ReadonlySet<string>>>>({});

  /** The keys of the hyperparameters of a break model that are pinned. */
  of(kind: BreakModelKind): ReadonlySet<string> {
    return this.pinned()[kind.id] ?? new Set();
  }

  /** Pins a hyperparameter of a break model, or unpins it. */
  toggle(kind: BreakModelKind, key: string): void {
    this.pinned.update((pinned) => {
      const next = new Set(pinned[kind.id]);
      if (!next.delete(key)) {
        next.add(key);
      }
      return { ...pinned, [kind.id]: next };
    });
  }
}
