import {
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { touchPoint } from '../../game/layers/keypad-layout';
import { RUN_CLOCK } from '../../player-data/run-recorder';
import { RunStore } from '../../player-data/run-store';
import { Touch, TouchLog } from '../../player-data/touch-log';
import { injectBackTo } from '../../ui/back-to-menu';
import { Candy } from '../../ui/candy';
import { DropdownMenu } from '../../ui/dropdown-menu';
import { KeypadMark } from '../play/keypad/keypad';
import { SPLASH_DURATION } from '../play/keypad/keypad';
import { Play } from '../play/play';
import { TIMER } from '../play/timer';
import { ReplayClock } from './replay-clock';

/** The speeds a run can be replayed at, and how each is labelled. */
export const SPEEDS: readonly { readonly speed: number; readonly label: string }[] = [
  { speed: 1 / 8, label: '×⅛' },
  { speed: 1 / 4, label: '×¼' },
  { speed: 1 / 2, label: '×½' },
  { speed: 1, label: '×1' },
  { speed: 2, label: '×2' },
  { speed: 4, label: '×4' },
  { speed: 8, label: '×8' },
];

/** How long a touch stays marked on the keypad, fading away, in milliseconds of the run. */
export const MARK_DURATION = 1000;
/** How long the replay goes on after the last touch, for the last group to end, in milliseconds of the run. */
export const TAIL = 1500;

/**
 * A run replayed, opened from the player's runs: the play screen, playing the run's touches as they came, on the run's
 * own clock, at the speed picked, under a bar to play and pause it, step through it touch by touch while paused, and
 * move along it on its timeline, and a menu of speeds. Each touch shows on the keypad, a mark where it was, fading away, and its key pressed
 * as long as a tap's shortest press, on the run's clock. The player can't type into it: the back button, or Escape,
 * goes back to their runs.
 */
@Component({
  selector: 'app-replay',
  imports: [Candy, DropdownMenu, Play],
  providers: [
    { provide: ReplayClock, useFactory: () => new ReplayClock() },
    { provide: TIMER, useExisting: ReplayClock },
    {
      provide: RUN_CLOCK,
      useFactory: () => {
        const clock = inject(ReplayClock);
        return { now: () => clock.now(), epoch: () => 0, newId: () => '' };
      },
    },
  ],
  host: { class: 'screen', '(document:keydown.escape)': 'escape($event)' },
  template: `
    <button type="button" appCandy="clear" class="corner back" aria-label="Back" (click)="back()">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
    @let replayed = log();
    @if (replayed !== undefined) {
      <app-play [replay]="replayed" [shownKey]="shownKey()" [marks]="marks()" />
      <div class="controls" role="group" aria-label="Replay">
        <button
          type="button"
          appCandy="clear"
          class="control"
          [attr.aria-label]="playing() ? 'Pause' : 'Play'"
          (click)="toggle()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            @if (playing()) {
              <rect x="6" y="5" width="4" height="14" rx="1.5" />
              <rect x="14" y="5" width="4" height="14" rx="1.5" />
            } @else {
              <path
                d="M8 5.5v13a1 1 0 0 0 1.5.9l10.5-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"
              />
            }
          </svg>
        </button>
        <button
          type="button"
          appCandy="clear"
          class="control"
          aria-label="Previous touch"
          [disabled]="playing() || applied() === 0"
          (click)="stepBack()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="5" width="3" height="14" rx="1" />
            <path
              d="M19 6.5v11a1 1 0 0 1-1.5.9l-8.5-5.5a1 1 0 0 1 0-1.8l8.5-5.5a1 1 0 0 1 1.5.9z"
            />
          </svg>
        </button>
        <button
          type="button"
          appCandy="clear"
          class="control"
          aria-label="Next touch"
          [disabled]="playing() || applied() === replayed.touches.length"
          (click)="stepForward()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="16" y="5" width="3" height="14" rx="1" />
            <path d="M5 6.5v11a1 1 0 0 0 1.5.9l8.5-5.5a1 1 0 0 0 0-1.8L6.5 5.6A1 1 0 0 0 5 6.5z" />
          </svg>
        </button>
        <input
          type="range"
          class="timeline"
          aria-label="Time"
          min="0"
          step="1"
          [max]="duration()"
          [value]="time()"
          [attr.aria-valuetext]="timeText()"
          (input)="scrub($event)"
        />
        <button
          type="button"
          class="frosted pill speed"
          aria-haspopup="true"
          [attr.aria-label]="'Speed ' + speedLabel()"
          (click)="speedMenu.openAt(above($event))"
        >
          {{ speedLabel() }}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
        </button>
        <app-dropdown-menu #speedMenu label="Speed" [button]="false">
          @for (option of speeds; track option.speed) {
            <button
              type="button"
              [disabled]="option.speed === speed()"
              (click)="speed.set(option.speed)"
            >
              {{ option.label }}
            </button>
          }
        </app-dropdown-menu>
      </div>
    } @else if (missing()) {
      <p class="missing">This run is no longer kept.</p>
    }
  `,
  styleUrl: './replay.css',
})
export class Replay {
  /** The touch log of the run replayed, once read. */
  protected readonly log = signal<TouchLog | undefined>(undefined);
  /** Whether there's no run kept under the id asked for. */
  protected readonly missing = signal(false);
  /** Where the replay is, in milliseconds of the run since its first digit. */
  protected readonly time = signal(0);
  /** How many of the run's touches have been played. */
  protected readonly applied = signal(0);
  protected readonly playing = signal(false);
  protected readonly speed = signal(1);
  protected readonly speeds = SPEEDS;
  protected readonly speedLabel = computed(
    () => SPEEDS.find(({ speed }) => speed === this.speed())?.label ?? '',
  );

  private readonly touches = computed((): readonly Touch[] => this.log()?.touches ?? []);
  /** How long the replay lasts: until a while after the last touch. */
  protected readonly duration = computed(() => (this.touches().at(-1)?.time ?? 0) + TAIL);
  protected readonly timeText = computed(
    () => `${(this.time() / 1000).toFixed(1)} of ${(this.duration() / 1000).toFixed(1)} seconds`,
  );

  /** The key of the last touch played, while it shows pressed: as long as a tap's shortest press, on the run's clock. */
  protected readonly shownKey = computed(() => {
    const touch = this.touches()[this.applied() - 1];
    return touch !== undefined && this.time() - touch.time < SPLASH_DURATION
      ? (touch.key ?? undefined)
      : undefined;
  });

  /** The touches played lately, marked where they were, fading away. */
  protected readonly marks = computed((): KeypadMark[] => {
    const log = this.log();
    const now = this.time();
    const marks: KeypadMark[] = [];
    for (let id = this.applied() - 1; id >= 0; id--) {
      const touch = this.touches()[id];
      if (log === undefined || touch === undefined || now - touch.time >= MARK_DURATION) {
        break;
      }
      marks.push({
        id,
        typed: touch.key !== null,
        faded: (now - touch.time) / MARK_DURATION,
        ...touchPoint(log.keypadLayout, touch),
      });
    }
    return marks;
  });

  protected readonly back = injectBackTo('/runs');
  private readonly clock = inject(ReplayClock);
  private readonly play = viewChild(Play);
  private readonly document = inject(DOCUMENT);
  private frame: number | undefined;
  /** When the last frame was drawn, on the page's clock. */
  private lastFrame = 0;

  constructor() {
    const id = inject(ActivatedRoute).snapshot.paramMap.get('id');
    void inject(RunStore)
      .touchLogs()
      .then((logs) => {
        const log = logs.find((stored) => stored.id === id);
        this.log.set(log);
        this.missing.set(log === undefined);
      });
    inject(DestroyRef).onDestroy(() => {
      this.stop();
    });
  }

  protected toggle(): void {
    if (this.playing()) {
      this.stop();
      return;
    }
    if (this.time() >= this.duration()) {
      this.seek(0, 0);
    }
    this.playing.set(true);
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  /** Back to just after the touch before the last one played. */
  protected stepBack(): void {
    const count = this.applied() - 1;
    this.seek(this.touches()[count - 1]?.time ?? 0, count);
  }

  /** On to the next touch. */
  protected stepForward(): void {
    const next = this.touches()[this.applied()];
    if (next !== undefined) {
      this.advance(next.time, this.applied() + 1);
    }
  }

  /** Moves along the timeline to where it was dragged, playing on from there if playing. */
  protected scrub(event: Event): void {
    const time = Number((event.target as HTMLInputElement).value);
    if (time >= this.time()) {
      this.advance(time);
    } else {
      this.seek(time);
    }
  }

  /** Where the menu of speeds opens: from the top of the button pressed, in window coordinates, over it if it fits. */
  protected above(event: Event): { readonly x: number; readonly y: number } {
    const button = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: button.left + button.width / 2, y: button.top };
  }

  /** Back to the player's runs, unless the Escape closes something open, as the browser does with it. */
  protected escape(event: Event): void {
    if (!event.defaultPrevented && this.document.querySelector(':popover-open') === null) {
      event.preventDefault();
      this.back();
    }
  }

  private readonly tick = (now: number): void => {
    const time = Math.min(this.duration(), this.time() + (now - this.lastFrame) * this.speed());
    this.lastFrame = now;
    this.advance(time);
    if (time >= this.duration()) {
      this.stop();
    } else {
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  private stop(): void {
    this.playing.set(false);
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
      this.frame = undefined;
    }
  }

  /**
   * Plays on to `time`, the touches up to it played, at most up to the `until`th, each at its time on the run's clock,
   * and what waits on the clock until then, such as the end of a group.
   */
  private advance(time: number, until = this.touches().length): void {
    const play = this.play();
    let applied = this.applied();
    for (let touch = this.touches()[applied]; ; touch = this.touches()[applied]) {
      if (play === undefined || touch === undefined || applied >= until || touch.time > time) {
        break;
      }
      this.clock.advanceTo(touch.time);
      play.replayTouch(touch);
      applied++;
    }
    this.clock.advanceTo(time);
    this.applied.set(applied);
    this.time.set(time);
  }

  /** Replays the run again from its start up to `time`, at once: no slots fly meanwhile. */
  private seek(time: number, until?: number): void {
    const play = this.play();
    play?.reset();
    this.clock.reset();
    this.applied.set(0);
    this.time.set(0);
    if (play !== undefined) {
      play.quiet = true;
    }
    this.advance(time, until);
    if (play !== undefined) {
      play.quiet = false;
    }
  }
}
