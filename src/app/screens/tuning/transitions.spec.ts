import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { parseTweaks, Tweaks } from '../../developer-mode/tweaks';
import { KEY_LINGER } from '../../game/layers/place-colors';
import { GAME_LINGER } from '../../game/modes/discovery-pace';
import { INDEXED_DB } from '../../player-data/run-store';
import { KEY_MOTION } from '../play/keypad/key-merges';
import { Transitions } from './transitions';
import { TURN_SWITCH } from '../play/turn-shown';

describe('Transitions', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: INDEXED_DB, useValue: undefined }],
    });
  });

  it('tunes how long the keys take to move, applied to the whole game while developer mode is on', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    const fixture = TestBed.createComponent(Transitions);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const [press, merge, linger, discoveryLinger, turnSwitch] = Array.from(
      host.querySelectorAll<HTMLInputElement>('input[type="range"]'),
    );
    const slide = (slider: HTMLInputElement | undefined, value: string): void => {
      if (slider !== undefined) {
        slider.value = value;
        slider.dispatchEvent(new Event('input'));
      }
    };
    slide(merge, '720');
    slide(linger, '3000');
    slide(press, '120');
    slide(discoveryLinger, '4');
    slide(turnSwitch, '500');
    await fixture.whenStable();

    const tweaks = TestBed.inject(Tweaks);
    expect(tweaks.keyMotion()).toEqual({ merge: 720, press: 120 });
    expect(tweaks.keyLinger()).toBe(3000);
    expect(tweaks.gameLinger()).toBe(4);
    expect(tweaks.turnSwitch()).toBe(500);
    expect(host.textContent).toContain('720 ms');

    Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent.trim() === 'Reset All')
      ?.click();
    await fixture.whenStable();
    expect(tweaks.keyMotion()).toEqual(KEY_MOTION);
    expect(tweaks.keyLinger()).toBe(KEY_LINGER);
    expect(tweaks.gameLinger()).toBe(GAME_LINGER);
    expect(tweaks.turnSwitch()).toBe(TURN_SWITCH);
  });

  it('keeps the keys tuned, leaving out what is not valid', () => {
    expect(
      parseTweaks({ format: 4, keyMotion: { merge: 500, press: 1010 }, keyLinger: 4000 }),
    ).toMatchObject({ keyMotion: { merge: 500, press: KEY_MOTION.press }, keyLinger: 4000 });
  });
});
