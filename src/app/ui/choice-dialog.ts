import {
  afterRenderEffect,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { ButtonList } from './button-list';
import { Candy } from './candy';
import { LightDismiss } from './light-dismiss';

let ids = 0;

/**
 * A dialog offering a choice, as a frosted card: its title, a corner button on either side of it, if any (given as
 * `cornerStart` and `cornerEnd`), what it says, if anything, and the buttons to choose from, one under the other (see
 * `ButtonList`), given as buttons. Corner buttons always keep a place on both sides of the title once there's one, an
 * unused one hidden, so that the title stays centered, wrapping if it must. It closes on Escape and on a click outside
 * it, unless it can't be dismissed, as when the game is over: then only a choice closes it. In reach, it sits two thirds
 * of the way down the screen, within the thumb's reach, as on the play screen. It opens with the focus on its first
 * choice, as the one to take at once, such as going back from a question.
 */
@Component({
  selector: 'app-choice-dialog',
  imports: [ButtonList, Candy, LightDismiss],
  // Unencapsulated, so that its rules reach what it's given too, scoped by its own name instead.
  encapsulation: ViewEncapsulation.None,
  template: `
    <dialog
      #dialog
      class="card"
      closedby="any"
      [class.in-reach]="inReach()"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="bodyId"
      (cancel)="dismissable() || $event.preventDefault()"
      (close)="closed.emit()"
    >
      <div class="heading">
        <span class="corner-place start">
          <button
            type="button"
            appCandy="clear"
            class="corner unused"
            disabled
            aria-hidden="true"
          ></button>
          <ng-content select="[cornerStart]" />
        </span>
        <h2 [id]="titleId">{{ heading() }}</h2>
        <span class="corner-place end">
          <button
            type="button"
            appCandy="clear"
            class="corner unused"
            disabled
            aria-hidden="true"
          ></button>
          <ng-content select="[cornerEnd]" />
        </span>
      </div>
      <div class="body" [id]="bodyId">
        <ng-content />
      </div>
      <app-button-list>
        <ng-content select="button" />
      </app-button-list>
    </dialog>
  `,
  styles: `
    app-choice-dialog {
      /* Only the dialog, which lays out over everything. */
      display: contents;
    }

    app-choice-dialog dialog.in-reach {
      inset: calc(200% / 3) 0 auto;
      margin-block: 0;
      translate: 0 -50%;
    }

    app-choice-dialog .heading {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      column-gap: var(--space-1);
      align-items: center;
      margin-bottom: var(--space-1);
    }

    app-choice-dialog .heading h2 {
      grid-area: 1 / 2;
      margin: 0;
      overflow-wrap: break-word;
    }

    /* A corner button over the unused one, which keeps its place. */
    app-choice-dialog .corner-place {
      display: grid;
    }

    app-choice-dialog .corner-place > * {
      grid-area: 1 / 1;
    }

    app-choice-dialog .start {
      grid-area: 1 / 1;
    }

    app-choice-dialog .end {
      grid-area: 1 / 3;
    }

    app-choice-dialog .unused {
      visibility: hidden;
    }

    /* No places for corner buttons when it has none: the title takes the whole width. */
    app-choice-dialog .heading:not(:has(.corner-place > :not(.unused))) .corner-place {
      display: none;
    }

    /* What it says, before the buttons, if anything. */
    app-choice-dialog .body {
      display: contents;
    }

    app-choice-dialog .body p {
      margin: 0;
      line-height: 1.45;
      text-align: center;
      text-shadow: var(--text-shadow);
    }
  `,
})
export class ChoiceDialog {
  readonly heading = input.required<string>();
  /** Whether Escape and a click outside it close it, as they do unless a choice must be made. */
  readonly dismissable = input(true);
  /** Whether it sits within the thumb's reach, two thirds of the way down the screen, rather than in the middle. */
  readonly inReach = input(false);
  /** It closed, whatever closed it. */
  readonly closed = output();

  protected readonly titleId = `choice-dialog-title-${String(++ids)}`;
  protected readonly bodyId = `choice-dialog-body-${String(ids)}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterRenderEffect({
      write: () => {
        this.dialog().nativeElement.setAttribute('closedby', this.dismissable() ? 'any' : 'none');
      },
    });
  }

  /** Whether it's open. */
  get isOpen(): boolean {
    return this.dialog().nativeElement.open;
  }

  /** Opens it, over everything, unless it's open already. */
  open(): void {
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) {
      // Marked for the browser to give it the focus as it opens the dialog, as it does for any modal dialog.
      dialog.querySelector('app-button-list button')?.setAttribute('autofocus', '');
      dialog.showModal();
    }
  }

  /** Closes it, settling once its transitions have ended, cancelled ones included. */
  async close(): Promise<void> {
    const dialog = this.dialog().nativeElement;
    dialog.close();
    await Promise.allSettled(dialog.getAnimations().map(async (animation) => animation.finished));
  }
}
