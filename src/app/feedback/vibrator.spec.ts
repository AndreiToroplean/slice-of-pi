import { TestBed } from '@angular/core/testing';
import { DeveloperMode } from '../developer-mode/developer-mode';
import { Tweaks } from '../developer-mode/tweaks';
import { INDEXED_DB } from '../player-data/run-store';
import { VibrationSetting } from '../player-data/vibration-setting';
import { FakeTime } from '../../testing/fake-time';
import { VIBRATE, vibrationOf, Vibrator } from './vibrator';
import { VIBRATION_PATTERNS } from './vibrations';

describe('Vibrator', () => {
  let time: FakeTime;
  let vibrated: (number | number[])[];

  beforeEach(() => {
    time = new FakeTime();
    vibrated = [];
    TestBed.configureTestingModule({
      providers: [
        ...time.providers,
        { provide: INDEXED_DB, useValue: undefined },
        {
          provide: VIBRATE,
          useValue: (pattern: number | number[]) => {
            vibrated.push(pattern);
          },
        },
      ],
    });
  });

  it('vibrates on an event in its pattern', () => {
    TestBed.inject(Vibrator).play('mistake');

    expect(vibrated).toEqual([[...VIBRATION_PATTERNS.mistake]]);
  });

  it('vibrates in the patterns tuned in developer mode', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    await TestBed.inject(Tweaks).setVibration('digit', [7, 8, 9]);

    TestBed.inject(Vibrator).play('digit');

    expect(vibrated).toEqual([[7, 8, 9]]);
  });

  it('does not vibrate once the player turned vibration off, but still tries a pattern', async () => {
    await TestBed.inject(VibrationSetting).set(false);
    const vibrator = TestBed.inject(Vibrator);

    vibrator.play('digit')();
    expect(vibrated).toEqual([]);

    vibrator.try([30, 10, 30]);
    expect(vibrated).toEqual([[30, 10, 30]]);
  });

  it('vibrates once for each delay, mixing with what still plays', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    await TestBed.inject(Tweaks).setVibration('landing', [10]);
    await TestBed.inject(Tweaks).setVibration('digit', [15]);
    const vibrator = TestBed.inject(Vibrator);

    vibrator.play('landing', [0, 30]);
    time.now = 5;
    vibrator.play('digit');

    expect(vibrated).toEqual([
      [10, 20, 10],
      [15, 10, 10],
    ]);
  });

  it('stops the vibrations yet to start, keeping the others', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    await TestBed.inject(Tweaks).setVibration('landing', [10]);
    await TestBed.inject(Tweaks).setVibration('pluck', [5]);
    const vibrator = TestBed.inject(Vibrator);
    const stop = vibrator.play('landing', [0, 30, 60]);
    vibrator.play('pluck', [50]);

    time.now = 35;
    stop();

    expect(vibrated.at(-1)).toEqual([5, 10, 5]);

    stop();
    expect(vibrated).toHaveLength(3);
  });

  it('stops vibrating once nothing is left to play', () => {
    const vibrator = TestBed.inject(Vibrator);
    const stop = vibrator.play('digit', [50]);

    stop();

    expect(vibrated.at(-1)).toBe(0);
  });

  it('vibrates on a click on a button', () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.addEventListener('click', (event) => {
      TestBed.inject(Vibrator).clicked(event);
    });

    button.click();

    expect(vibrated).toEqual([[...VIBRATION_PATTERNS.button]]);
    button.remove();
  });
});

describe('vibrationOf', () => {
  function element(html: string, selector: string): Element {
    const host = document.createElement('div');
    host.innerHTML = html;
    const found = host.querySelector(selector);
    if (found === null) {
      throw new Error(`No ${selector}`);
    }
    return found;
  }

  it('is the button vibration for what is clicked as a button, or within one', () => {
    expect(vibrationOf(element('<button><svg></svg></button>', 'svg'))).toBe('button');
    expect(vibrationOf(element('<a href="/runs">Runs</a>', 'a'))).toBe('button');
    expect(vibrationOf(element('<div role="radio">A</div>', 'div'))).toBe('button');
    expect(vibrationOf(element('<input type="checkbox" />', 'input'))).toBe('button');
  });

  it('is the vibration a button names, if any', () => {
    expect(vibrationOf(element('<a href="/play" data-vibration="play">Play</a>', 'a'))).toBe(
      'play',
    );
    expect(vibrationOf(element('<button data-vibration="none">Try</button>', 'button'))).toBe(
      undefined,
    );
  });

  it('is none for what is not a button, nor for the keys, which vibrate for what they type, unlike the pause key', () => {
    expect(vibrationOf(element('<p>Text</p>', 'p'))).toBeUndefined();
    expect(vibrationOf(element('<a>No link</a>', 'a'))).toBeUndefined();
    expect(vibrationOf(element('<input type="range" />', 'input'))).toBeUndefined();
    expect(
      vibrationOf(element('<app-keypad><button data-key="3">3</button></app-keypad>', 'button')),
    ).toBeUndefined();
    expect(
      vibrationOf(element('<app-keypad><button title="Pause">II</button></app-keypad>', 'button')),
    ).toBe('button');
    expect(vibrationOf(null)).toBeUndefined();
  });
});
