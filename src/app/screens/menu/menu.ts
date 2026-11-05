import { NgOptimizedImage } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Background } from '../../ui/background';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { DeveloperTaps } from '../../developer-mode/developer-taps';
import { CdkMenuGroup, CdkMenuItem } from '@angular/cdk/menu';
import { Dropdown, MenuTrigger } from '../../ui/menu';
import { OverlayHost } from '../../ui/overlay-host';
import { MenuAssets } from './menu-assets';
import { ButtonList } from '../../ui/button-list';
import { Candy } from '../../ui/candy';
import { Tweaks } from '../../developer-mode/tweaks';
import { Light, LightLayer } from '../../ui/light-layer';
import { LIGHT_LAYERS, LightLayer as Layer, menuStyles, MenuLook } from './menu-look';
import { Layout, layoutStyles } from '../../ui/layout';
import { MenuEditor } from './menu-editor';
import { ScreenTransitions } from '../../ui/screen-transitions';

/** Which key color lights each letter of the name, from the palette, in order: every one but lime, round the wheel. */
const LETTER_COLORS = [0, 1, 2, 4, 5, 6, 7, 8, 9];

/** The seed of the rays of each layer's first light; the others' follow from it. */
const SEEDS: Readonly<Record<Layer, number>> = { icon: 31, slice: 101, pi: 503 };

/** How long each layer of light takes to fade in or out, in milliseconds. */
export const LIGHT_FADE = 120;
/** How long after a layer the next one starts fading, in milliseconds, from the top down: the icon, "Slice of", "Pi". */
export const LIGHT_STAGGER = 40;
/** How long the lights take to switch off, all of them. */
export const LIGHTS_OFF = LIGHT_FADE + 2 * LIGHT_STAGGER;

/**
 * Loads the page again, the browser asking the server whether the copy it keeps is still the latest: the way to get a
 * build just published, from an installed app, which has no reload button of its own.
 */
export const RELOAD_PAGE = new InjectionToken<() => void>('RELOAD_PAGE', {
  factory: () => {
    const location = inject(DOCUMENT).location;
    return () => {
      location.reload();
    };
  },
});

/** No lights, before the menu is measured. */
const DARK: Readonly<Record<Layer, readonly Light[]>> = { icon: [], slice: [], pi: [] };

/**
 * The main menu, where the app opens: the game's icon and name, a button to start a challenge, one above it to free play, and one above that to the player's runs,
 * the settings behind a gear in a corner, and in developer mode, its pages in an overflow menu in the other, with its
 * editor (see `menu-editor.ts`). The name's letters are lanterns, in the key colors, and the icon is lit from behind:
 * three layers of light (see `light-layer.ts`), "Pi" nearest, then "Slice of", then the icon, each lighting everything
 * behind it. Where each part sits, always centered across, and their light, come from its look (see `menu-look.ts`).
 * The lights switch on once the menu is in place, and off before another screen comes in, both from the top down, the
 * icon first, "Pi" last. It shows
 * once its icon and fonts have arrived, over the background alone until then. Tab, or left and right, go from one group of buttons to the next, from the left to the right, and up and
 * down between its main buttons; Challenge has the focus from the start, picked out, for Enter to play.
 */
@Component({
  selector: 'app-menu',
  imports: [
    NgOptimizedImage,
    RouterLink,
    ButtonList,
    Candy,
    CdkMenuGroup,
    CdkMenuItem,
    DeveloperTaps,
    Dropdown,
    LightLayer,
    MenuEditor,
    MenuTrigger,
    OverlayHost,
  ],
  host: {
    class: 'screen',
    '[class.loading]': '!assets.ready()',
    '[style]': 'styles()',
    '[style.--light-fade]': 'lightFade',
    '[style.--light-stagger]': 'lightStagger',
    '(document:keydown.arrowup)': 'startOnPlay($event)',
    '(document:keydown.arrowdown)': 'startOnPlay($event)',
    '(document:keydown.arrowleft)': 'side($event, -1)',
    '(document:keydown.arrowright)': 'side($event, 1)',
  },
  template: `
    <canvas
      class="light icon-light"
      [class.on]="lit()"
      [appLightLayer]="lights().icon"
      [settings]="look().light.icon"
    ></canvas>
    <canvas
      class="light slice-light"
      [class.on]="lit()"
      [appLightLayer]="lights().slice"
      [settings]="look().light.slice"
    ></canvas>
    <canvas
      class="light pi-light"
      [class.on]="lit()"
      [appLightLayer]="lights().pi"
      [settings]="look().light.pi"
    ></canvas>
    <a appCandy="clear" class="corner settings" routerLink="/settings" title="Settings">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
    </a>
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
      <!-- The name written in lanterns, tiles like the typed digits. -->
      <span class="lines" aria-hidden="true">
        @for (line of title(); track $index) {
          <span class="line" [class]="line.layer">
            @for (word of line.words; track $index) {
              <span class="word">
                @for (letter of word; track $index) {
                  <span class="tile" [style.--lantern]="letter.color">{{ letter.letter }}</span>
                }
              </span>
            }
          </span>
        }
      </span>
    </h1>
    <p class="developer-message" role="status" [class.shown]="taps.shown()">
      {{ taps.message() }}
    </p>
    <app-button-list class="actions" [style.gap]="'var(--buttons-gap)'">
      <a appCandy routerLink="/runs">Your Runs</a>
      <a appCandy routerLink="/play" data-vibration="play">Free Play</a>
      <a #play appCandy="primary" routerLink="/challenge" data-vibration="play">Challenge</a>
    </app-button-list>
    <!-- After the middle of the menu, for Tab to go through it from the left to the right. -->
    @if (developerMode.enabled()) {
      <!-- Loaded only in developer mode, with the menu it opens. -->
      @defer {
        <div class="more" appOverlayHost>
          <button
            type="button"
            appCandy="clear"
            class="corner"
            title="Developer Pages"
            appMenuTriggerMore
            [appMenuTrigger]="developerMenu"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5.5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="18.5" r="2" />
            </svg>
          </button>
        </div>
        <ng-template #developerMenu>
          <div appDropdown aria-labelledby="developer-title">
            <div cdkMenuGroup class="section">
              <h2 id="developer-title">Developer</h2>
              <a cdkMenuItem routerLink="/developer/break-models">Break Models</a>
              <a cdkMenuItem routerLink="/developer/sound-models">Sound Models</a>
              <a cdkMenuItem routerLink="/developer/key-colors">Key Colors</a>
              <a cdkMenuItem routerLink="/developer/background-colors">Background Colors</a>
              <a cdkMenuItem routerLink="/developer/vibrations">Vibrations</a>
              <!-- The pages above, an action below. -->
              <hr />
              <button cdkMenuItem type="button" (cdkMenuItemTriggered)="edit()">
                Edit Main Menu
              </button>
              <button cdkMenuItem type="button" (cdkMenuItemTriggered)="reload()">Reload</button>
            </div>
          </div>
        </ng-template>
      }
    }
    @let edited = editedLook();
    @if (edited !== undefined) {
      <app-menu-editor
        [look]="edited"
        (lookChange)="editedLook.set($event)"
        [layout]="editedLayout() ?? tweaks.layout()"
        (layoutChange)="editedLayout.set($event)"
        [lights]="lights()"
        (done)="editedLook.set(undefined); editedLayout.set(undefined)"
      />
    }
  `,
  styleUrl: './menu.css',
})
export class Menu {
  protected readonly name = 'Slice of Pi';
  /** The name's words, line by line, each line a layer of light: "Pi" stands on its own line, bigger, nearest. */
  private readonly lines: readonly (readonly [Layer, readonly string[]])[] = [
    ['slice', ['Slice', 'of']],
    ['pi', ['Pi']],
  ];
  protected readonly developerMode = inject(DeveloperMode);
  protected readonly tweaks = inject(Tweaks);

  /** The look being edited, in developer mode's editor, shown as it changes. */
  protected readonly editedLook = signal<MenuLook | undefined>(undefined);
  /** The margins and corner buttons being edited there, in the layout of every screen, shown as they change. */
  protected readonly editedLayout = signal<Layout | undefined>(undefined);
  protected readonly look = computed(() => this.editedLook() ?? this.tweaks.menu());
  protected readonly styles = computed(() => {
    const layout = this.editedLayout();
    return {
      ...(layout === undefined ? {} : layoutStyles(layout)),
      ...menuStyles(this.look()),
    };
  });
  /** The name's lines, each letter with the key color of its lantern. */
  protected readonly title = computed(() => {
    const palette = this.tweaks.palette();
    let at = 0;
    return this.lines.map(([layer, words]) => ({
      layer,
      words: words.map((word) =>
        Array.from(word, (letter) => ({
          letter,
          color: palette[LETTER_COLORS[at++ % LETTER_COLORS.length] ?? 0] ?? '#ffffff',
        })),
      ),
    }));
  });
  /** The lights of each layer, where the menu's lanterns and icon are. */
  protected readonly lights = signal(DARK);
  /** Bumped as the menu's size changes, for the lights to follow. */
  private readonly resized = signal(0);
  /** Whether the lights are on: once the menu is in place, until it's left. */
  protected readonly lit = signal(false);
  protected readonly lightFade = `${String(LIGHT_FADE)}ms`;
  protected readonly lightStagger = `${String(LIGHT_STAGGER)}ms`;

  protected readonly assets = inject(MenuAssets);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly play = viewChild.required<string, ElementRef<HTMLElement>>('play', {
    read: ElementRef,
  });

  constructor() {
    const fonts = this.document.fonts;
    afterNextRender(() => void this.assets.waitForFonts(fonts));
    // The lights switch on once the menu is in place: shown, and no transition from another screen running, which would
    // show them laid over the background rather than added to it (see `styles.css`).
    const transitions = inject(ScreenTransitions);
    effect(() => {
      if (this.assets.ready() && transitions.settled()) {
        this.lit.set(true);
      }
    });
    afterRenderEffect({
      read: () => {
        this.styles();
        this.title();
        this.resized();
        this.lights.set(this.measure());
      },
    });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        this.resized.update((count) => count + 1);
      });
      observer.observe(this.host);
      inject(DestroyRef).onDestroy(() => {
        observer.disconnect();
      });
    }
    // Once shown, as it can't take the focus before. Picked out even after a tap, on touch screens too, so that it
    // breathes and shines.
    afterRenderEffect(() => {
      if (this.assets.ready()) {
        this.play().nativeElement.focus({ focusVisible: true });
      }
    });

    // A twilight sky, rather than a season's colors.
    const background = inject(Background);
    effect(() => {
      background.colors.set(this.tweaks.twilight());
    });
  }

  /**
   * Switches the lights off, from the top down, before another screen comes in, settling once they're off: at once
   * if they weren't on.
   */
  switchOff(): Promise<boolean> {
    if (!this.lit()) {
      return Promise.resolve(true);
    }
    this.lit.set(false);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, LIGHTS_OFF);
    });
  }

  /** Loads the page again, from developer mode's menu. */
  protected readonly reload = inject(RELOAD_PAGE);

  /** Opens the editor of the menu's look, from developer mode's menu. */
  protected edit(): void {
    this.editedLook.set(this.look());
  }

  /** The lights of each layer, at the middle of each lantern, and behind the icon, at the height its look says. */
  private measure(): Readonly<Record<Layer, readonly Light[]>> {
    const frame = this.host.getBoundingClientRect();
    const center = (element: Element): { x: number; y: number } => {
      const box = element.getBoundingClientRect();
      return { x: box.x - frame.x + box.width / 2, y: box.y - frame.y + box.height / 2 };
    };
    const look = this.look();
    const icon = this.host.querySelector('.icon');
    const lanterns = (layer: Layer): Light[] =>
      Array.from(this.host.querySelectorAll<HTMLElement>(`.${layer} .tile`), (tile, i) => ({
        ...center(tile),
        color: tile.style.getPropertyValue('--lantern') || '#ffffff',
        seed: SEEDS[layer] + i * 7919,
      }));
    const lights: Record<Layer, readonly Light[]> = {
      icon: icon === null ? [] : [this.iconLight(center(icon), icon.clientWidth, look)],
      slice: lanterns('slice'),
      pi: lanterns('pi'),
    };
    return LIGHT_LAYERS.every(
      (layer) => JSON.stringify(lights[layer]) === JSON.stringify(this.lights()[layer]),
    )
      ? this.lights()
      : lights;
  }

  /**
   * The light behind the icon, whose middle is at `at`, and which is `width` pixels wide: its offset from the icon's
   * middle is in hundredths of the column's width, as the icon's size is, which gives the column's width.
   */
  private iconLight(at: { x: number; y: number }, width: number, look: MenuLook): Light {
    const column = (width * 100) / look.layout.icon.size;
    return {
      x: at.x,
      y: at.y - (look.iconLight.offset * column) / 100,
      color: look.iconLight.color,
      seed: SEEDS.icon,
    };
  }

  /** Up or down onto Challenge when nothing has the focus, as on touch screens, from where they move on. */
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
      (stop) => stop.tabIndex >= 0,
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
