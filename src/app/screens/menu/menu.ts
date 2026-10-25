import { NgOptimizedImage } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Background } from '../../ui/background';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { DeveloperTaps } from '../../developer-mode/developer-taps';
import { Tweaks } from '../../developer-mode/tweaks';
import { DropdownMenu } from '../../ui/dropdown-menu';
import { seasonAt } from '../../game/layers/seasons';
import { MenuAssets } from './menu-assets';
import { ButtonList } from '../../ui/button-list';
import { Candy } from '../../ui/candy';

/**
 * The main menu, where the app opens: the game's icon and name, a button to play and one above it to the player's runs,
 * the settings behind a gear in a corner, and in developer mode, its pages in an overflow menu in the other. It shows
 * once its icon and fonts have arrived, over the background alone until then. Tab, or left and right, go from one group of buttons to the next, from the left to the right, and up and
 * down between its main buttons; Play has the focus from the start, picked out, for Enter to play.
 */
@Component({
  selector: 'app-menu',
  imports: [NgOptimizedImage, RouterLink, ButtonList, Candy, DeveloperTaps, DropdownMenu],
  host: {
    class: 'screen',
    '[class.loading]': '!assets.ready()',
    '(document:keydown.arrowup)': 'startOnPlay($event)',
    '(document:keydown.arrowdown)': 'startOnPlay($event)',
    '(document:keydown.arrowleft)': 'side($event, -1)',
    '(document:keydown.arrowright)': 'side($event, 1)',
  },
  template: `
    <a appCandy="clear" class="corner settings" routerLink="/settings" title="Settings">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
    </a>
    <div class="title">
      <!-- Tapping it ten times in a row turns developer mode on or off. -->
      <button
        #taps="developerTaps"
        appDeveloperTaps
        type="button"
        class="icon-button"
        aria-label="Slice of Pi"
      >
        <img
          class="icon"
          ngSrc="icons/icon.webp"
          width="136"
          height="136"
          alt=""
          priority
          (load)="assets.iconDone()"
          (error)="assets.iconDone()"
        />
      </button>
      <h1>
        <span class="visually-hidden">{{ name }}</span>
        <!-- The name written in tiles, like the typed digits. -->
        <span class="lines" aria-hidden="true">
          @for (line of lines; track $index) {
            <span class="line">
              @for (word of line; track $index) {
                <span class="word">
                  @for (letter of word; track $index) {
                    <span class="tile">{{ letter }}</span>
                  }
                </span>
              }
            </span>
          }
        </span>
      </h1>
    </div>
    <p class="developer-message" role="status" [class.shown]="taps.shown()">
      {{ taps.message() }}
    </p>
    <app-button-list class="actions">
      <a appCandy routerLink="/runs">Your Runs</a>
      <a #play appCandy="primary" routerLink="/play">Play</a>
    </app-button-list>
    <!-- After the middle of the menu, for Tab to go through it from the left to the right. -->
    @if (developerMode.enabled()) {
      <app-dropdown-menu label="Developer Pages">
        <div class="section" role="group" aria-labelledby="developer-title">
          <h2 id="developer-title">Developer</h2>
          <a routerLink="/developer/key-colors">Key Colors</a>
          <a routerLink="/developer/season-colors">Season Colors</a>
        </div>
      </app-dropdown-menu>
    }
  `,
  styleUrl: './menu.css',
})
export class Menu {
  protected readonly name = 'Slice of Pi';
  /** The name's words, line by line: "Pi" stands on its own line, bigger. */
  protected readonly lines = [['Slice', 'of'], ['Pi']];
  protected readonly developerMode = inject(DeveloperMode);

  /** The values tuned in developer mode, the seasons' colors among them. */
  private readonly tweaks = inject(Tweaks);
  protected readonly assets = inject(MenuAssets);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly play = viewChild.required<string, ElementRef<HTMLElement>>('play', {
    read: ElementRef,
  });

  constructor() {
    const fonts = this.document.fonts;
    afterNextRender(() => void this.assets.waitForFonts(fonts));
    // Once shown, as it can't take the focus before. Picked out even after a tap, on touch screens too, so that it
    // breathes and shines.
    afterRenderEffect(() => {
      if (this.assets.ready()) {
        this.play().nativeElement.focus({ focusVisible: true });
      }
    });

    // The background of a new game, so that playing starts on the same colors.
    const background = inject(Background);
    effect(() => {
      background.colors.set(
        seasonAt(0, this.tweaks.seasonBackgrounds(), this.tweaks.colorSpace()).background,
      );
    });
  }

  /** Up or down onto Play when nothing has the focus, as on touch screens, from where they move on. */
  protected startOnPlay(event: Event): void {
    const active = this.document.activeElement;
    if (active === null || active === this.document.body) {
      event.preventDefault();
      this.play().nativeElement.focus();
    }
  }

  /**
   * Left and right go back and on as Tab does, from one group to the next: the settings, the game's icon, the main
   * buttons, the overflow menu's button. Not from within the overflow menu, nor past either end.
   */
  protected side(event: Event, step: number): void {
    const stops = Array.from(this.host.querySelectorAll<HTMLElement>('a[href], button')).filter(
      (stop) => stop.tabIndex >= 0 && stop.closest('[popover]') === null,
    );
    const at = stops.findIndex((stop) => stop.matches(':focus'));
    const next = at === -1 ? undefined : stops[at + step];
    if (next !== undefined) {
      event.preventDefault();
      next.focus();
    } else {
      this.startOnPlay(event);
    }
  }
}
