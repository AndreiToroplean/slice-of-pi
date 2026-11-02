import { Component, input } from '@angular/core';
import { SoundNotes } from '../../../game/layers/sound/sound-model';

/** How long the notes show before they fade out, and how long they take to, in ms. */
export const SOUND_NOTES_SHOWN = 2500;
export const SOUND_NOTES_FADE = 600;

/**
 * Developer mode's notes on what the key just typed played, in words, between the season header and the tape: what
 * comes from π on the left, what comes from the player's word on the right. They show for a while, then fade out,
 * unless the next key typed replaces them first.
 */
@Component({
  selector: 'app-sound-notes',
  host: {
    role: 'status',
    '[style.--shown]': 'shown + "ms"',
    '[style.--fade]': 'fade + "ms"',
  },
  template: `
    <section aria-label="From π">
      <h2>π</h2>
      <dl>
        @for (fact of notes().pi; track fact.label) {
          <dt>{{ fact.label }}</dt>
          <dd>{{ fact.value }}</dd>
        }
      </dl>
    </section>
    <section aria-label="From the word">
      <h2>Word</h2>
      <dl>
        @for (fact of notes().word; track fact.label) {
          <dt>{{ fact.label }}</dt>
          <dd>{{ fact.value }}</dd>
        }
      </dl>
    </section>
  `,
  styleUrl: './sound-notes.css',
})
export class SoundNotesView {
  readonly notes = input.required<SoundNotes>();
  protected readonly shown = SOUND_NOTES_SHOWN;
  protected readonly fade = SOUND_NOTES_FADE;
}
