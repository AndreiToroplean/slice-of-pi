import { Component, input } from '@angular/core';

/**
 * Developer mode's log of what the keys played: a line for each key, and for each word as it lands, the newest at the
 * bottom, the older ones scrolling up out of sight.
 */
@Component({
  selector: 'app-sound-log',
  host: { role: 'log', 'aria-label': 'What the keys played' },
  template: `
    <!-- Newest first, laid out from the bottom up, so that the newest line is always in sight. -->
    @for (line of newestFirst(); track $index) {
      <p>{{ line }}</p>
    }
  `,
  styleUrl: './sound-log.css',
})
export class SoundLog {
  /** The lines, oldest first. */
  readonly lines = input.required<readonly string[]>();

  protected newestFirst(): readonly string[] {
    return [...this.lines()].reverse();
  }
}
