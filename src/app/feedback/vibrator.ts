import { inject, InjectionToken, Service } from '@angular/core';
import { Tweaks } from '../developer-mode/tweaks';
import { RUN_CLOCK } from '../player-data/run-recorder';
import { VibrationSetting } from '../player-data/vibration-setting';
import { Buzz, buzzesOf, mix, Vibration, VibrationPattern, VIBRATIONS } from './vibrations';

/** Has the phone vibrate in a pattern, cutting off the one before, or stop with `0`; nothing where it can't. */
export const VIBRATE = new InjectionToken<(pattern: number | number[]) => void>('VIBRATE', {
  factory: () => (pattern) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  },
});

/** What vibrates as a button when clicked, unless it says otherwise. */
const CLICKABLE = [
  'button',
  'a[href]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
].join(', ');

/**
 * The vibration of a click on `target`: that of the button clicked, or of what holds it, as a button, unless it names
 * another in its `data-vibration` attribute, or `none`. The keypad's keys (`data-key`) have their own, for what they
 * type, but what else sits in the keypad, such as the pause key, vibrates as a button.
 */
export function vibrationOf(target: EventTarget | null): Vibration | undefined {
  const clicked = target instanceof Element ? target.closest(CLICKABLE) : null;
  if (clicked === null) {
    return undefined;
  }
  const named = clicked.getAttribute('data-vibration');
  if (named !== null) {
    return VIBRATIONS.find((vibration) => vibration === named);
  }
  return clicked.closest('[data-key]') === null ? 'button' : undefined;
}

interface OwnedBuzz extends Buzz {
  /** The call that played it, to stop it. */
  readonly owner: number;
}

/**
 * Vibrates the phone on the game's events, in their patterns, as tuned in developer mode, unless the player turned
 * vibration off. Vibrations close together mix, rather than cutting each other off (see {@link mix}).
 */
@Service()
export class Vibrator {
  private readonly vibrate = inject(VIBRATE);
  private readonly clock = inject(RUN_CLOCK);
  private readonly setting = inject(VibrationSetting);
  private readonly tweaks = inject(Tweaks);
  /** The buzzes playing or to come. */
  private buzzes: readonly OwnedBuzz[] = [];
  private calls = 0;

  /**
   * Vibrates on an event, once for each of `delays`, in ms from now; returns a function that stops those vibrations
   * yet to start, such as once what they go with is cut short.
   */
  play(vibration: Vibration, delays: readonly number[] = [0]): () => void {
    return this.setting.enabled()
      ? this.start(this.tweaks.vibrationPatterns()[vibration], delays)
      : () => undefined;
  }

  /** Vibrates on a click, if it's on something that does (see {@link vibrationOf}). */
  clicked(event: Event): void {
    const vibration = vibrationOf(event.target);
    if (vibration !== undefined) {
      this.play(vibration);
    }
  }

  /** Vibrates in a pattern now, to try it, even if the player turned vibration off. */
  try(pattern: VibrationPattern): void {
    this.start(pattern, [0]);
  }

  private start(pattern: VibrationPattern, delays: readonly number[]): () => void {
    const now = this.clock.now();
    const owner = ++this.calls;
    this.buzzes = [
      ...this.buzzes.filter(({ end }) => end > now),
      ...delays.flatMap((delay) =>
        buzzesOf(pattern, now + delay).map((buzz) => ({ ...buzz, owner })),
      ),
    ];
    const mixed = mix(this.buzzes, now);
    if (mixed.length > 0) {
      this.vibrate(mixed);
    }
    return () => {
      const at = this.clock.now();
      const kept = this.buzzes.filter((buzz) => buzz.owner !== owner || buzz.start <= at);
      if (kept.length === this.buzzes.length) {
        return;
      }
      this.buzzes = kept.filter(({ end }) => end > at);
      const left = mix(this.buzzes, at);
      this.vibrate(left.length === 0 ? 0 : left);
    };
  }
}
