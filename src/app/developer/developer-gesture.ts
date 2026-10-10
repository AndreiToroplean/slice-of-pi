import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';
import { DeveloperMode } from './developer-mode';

/** How long the button is held, without moving, before it can be dragged. */
export const HOLD_MS = 5000;
/** How far the finger may wander while holding, in pixels, before the hold is given up. */
export const HOLD_SLOP = 10;
/** How long the closing message stays on screen. */
export const CELEBRATION_MS = 3000;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The round target the button is dragged to, in window coordinates. */
export interface Target extends Point {
  readonly radius: number;
}

/** Where the target sits in a window of this size: centered, near the bottom. */
export function targetIn(width: number, height: number): Target {
  const radius = 44;
  return { x: width / 2, y: height - radius - 40, radius };
}

/** Whether a point is on the target, with a little give around it, for a finger. */
export function isOnTarget(point: Point, target: Target): boolean {
  return Math.hypot(point.x - target.x, point.y - target.y) <= target.radius + 12;
}

/**
 * Where the gesture is: `holding` the button still, `dragging` it once it's been held long enough, or `celebrating`
 * after it was dropped on the target, while the closing message shows.
 */
export type GesturePhase = 'idle' | 'holding' | 'dragging' | 'celebrating';

/** What the gesture says along the way, depending on whether it turns developer mode on or off. */
export const MESSAGES = {
  on: {
    dragging: 'Becoming a developer…',
    onTarget: 'Let go to become a developer',
    done: "Congrats, you're a developer!",
  },
  off: {
    dragging: 'Forgetting all the code…',
    onTarget: 'Let go to give it all up',
    done: "You're a mere player again. Enjoy the digits!",
  },
} as const;

/**
 * The secret gesture that turns developer mode on and off, on a button (the main menu's overflow button): hold the
 * button for 5 seconds, until the phone vibrates, then drag it down to the target that appears at the bottom of the
 * screen, and let go there. The same gesture turns it back off. Letting go anywhere else, or moving while holding, gives
 * up, and a short tap stays a tap.
 */
@Directive({
  selector: '[appDeveloperGesture]',
  exportAs: 'developerGesture',
  host: {
    class: 'developer-gesture',
    '[class.dragged]': "phase() === 'dragging'",
    '[style.translate]': 'translate()',
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'up($event)',
    '(pointercancel)': 'cancel()',
    '(click)': 'click($event)',
    '(contextmenu)': '$event.preventDefault()',
  },
})
export class DeveloperGesture {
  private readonly developerMode = inject(DeveloperMode);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly phase = signal<GesturePhase>('idle');
  /** Whether the gesture turns developer mode on, rather than off. */
  readonly turnsOn = signal(true);
  /** How far the button was dragged from its place. */
  readonly offset = signal<Point>({ x: 0, y: 0 });
  readonly onTarget = signal(false);
  readonly target = signal<Target>({ x: 0, y: 0, radius: 0 });

  /** What to say, if anything. */
  readonly message = computed(() => {
    const messages = MESSAGES[this.turnsOn() ? 'on' : 'off'];
    switch (this.phase()) {
      case 'dragging':
        return this.onTarget() ? messages.onTarget : messages.dragging;
      case 'celebrating':
        return messages.done;
      default:
        return '';
    }
  });

  protected readonly translate = computed(() => {
    const { x, y } = this.offset();
    return x === 0 && y === 0 ? null : `${String(x)}px ${String(y)}px`;
  });

  private start: Point = { x: 0, y: 0 };
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Whether the click that follows a gesture should be swallowed, so the button doesn't also do what a tap does. */
  private swallowClick = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
    });
  }

  protected down(event: PointerEvent): void {
    if (this.phase() !== 'idle' || !event.isPrimary) {
      return;
    }
    this.start = { x: event.clientX, y: event.clientY };
    this.swallowClick = false;
    this.phase.set('holding');
    // Keeps following the finger once it leaves the button.
    if ('setPointerCapture' in this.host) {
      this.host.setPointerCapture(event.pointerId);
    }
    this.timer = setTimeout(() => {
      this.arm();
    }, HOLD_MS);
  }

  protected move(event: PointerEvent): void {
    const point = { x: event.clientX, y: event.clientY };
    if (this.phase() === 'holding') {
      if (Math.hypot(point.x - this.start.x, point.y - this.start.y) > HOLD_SLOP) {
        this.cancel();
      }
    } else if (this.phase() === 'dragging') {
      this.offset.set({ x: point.x - this.start.x, y: point.y - this.start.y });
      this.onTarget.set(isOnTarget(point, this.target()));
    }
  }

  protected up(event: PointerEvent): void {
    if (this.phase() !== 'dragging') {
      this.cancel();
      return;
    }
    this.offset.set({ x: 0, y: 0 });
    if (!isOnTarget({ x: event.clientX, y: event.clientY }, this.target())) {
      this.phase.set('idle');
      return;
    }
    void this.developerMode.set(this.turnsOn());
    this.phase.set('celebrating');
    this.timer = setTimeout(() => {
      this.phase.set('idle');
    }, CELEBRATION_MS);
  }

  /** Gives up the gesture, unless it's already done. */
  protected cancel(): void {
    if (this.phase() === 'celebrating') {
      return;
    }
    clearTimeout(this.timer);
    this.offset.set({ x: 0, y: 0 });
    this.onTarget.set(false);
    this.phase.set('idle');
  }

  protected click(event: MouseEvent): void {
    if (this.swallowClick) {
      this.swallowClick = false;
      // Keeps the button from doing what a tap does, such as opening its popover.
      event.preventDefault();
    }
  }

  /** Held long enough: the button follows the finger from now on, and the target appears. */
  private arm(): void {
    const navigator = this.window?.navigator;
    if (navigator !== undefined && 'vibrate' in navigator) {
      navigator.vibrate(60);
    }
    this.swallowClick = true;
    this.turnsOn.set(!this.developerMode.enabled());
    this.target.set(targetIn(this.window?.innerWidth ?? 0, this.window?.innerHeight ?? 0));
    this.onTarget.set(false);
    this.phase.set('dragging');
  }
}
