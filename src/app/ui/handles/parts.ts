import { Component, input, model } from '@angular/core';

/** A part of a screen an editor picks out, to show its handles alone: what it's called, and its box, in CSS. */
export interface EditedPart<P extends string = string> {
  readonly id: P;
  readonly name: string;
  readonly box: Readonly<Record<string, string>>;
}

/**
 * The parts of a screen an editor edits, each in a dashed box: tapping one picks it out, solid, for the editor to show
 * its handles alone, and tapping it again picks none, for the editor to show those of the screen as a whole.
 */
@Component({
  selector: 'app-parts',
  template: `
    @for (part of parts(); track part.id) {
      <button
        type="button"
        class="part"
        [style]="part.box"
        [attr.aria-pressed]="picked() === part.id"
        [attr.aria-label]="part.name"
        (click)="pick(part.id, $event)"
      ></button>
    }
  `,
  styles: `
    /* Over the screen, but for its boxes, taking no touches. */
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .part {
      position: absolute;
      padding: 0;
      border: 1px dashed rgb(255 255 255 / 60%);
      border-radius: 0.5rem;
      background: none;
      cursor: pointer;
      pointer-events: auto;
      -webkit-tap-highlight-color: transparent;

      &[aria-pressed='true'] {
        border: 2px solid rgb(255 255 255 / 90%);
        background: rgb(255 255 255 / 6%);
      }

      &:focus-visible {
        outline: 0.1875rem solid var(--focus-ring);
      }
    }
  `,
})
export class Parts {
  readonly parts = input.required<readonly EditedPart[]>();
  /** The part picked out, if any. */
  readonly picked = model<string | undefined>(undefined);

  protected pick(id: string, event: Event): void {
    event.stopPropagation();
    this.picked.set(this.picked() === id ? undefined : id);
  }
}
