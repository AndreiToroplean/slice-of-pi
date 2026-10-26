import { ComponentFixture, TestBed } from '@angular/core/testing';
import { isDigit } from '../../../game/pi/digit';
import { keyColors, PALETTE } from '../../../game/layers/place-colors';
import { Keypad, REPEAT_DELAY, REPEAT_INTERVAL, SPLASH_DURATION } from './keypad';
import { KeypadKey, KeypadTouch } from '../../../game/layers/keypad-layout';

/**
 * Center of each key's cell on the 300 × 400 grid of keys used here (100 × 100 cells), in a keypad reaching 30 beyond it
 * on its sides, 20 above and 40 below.
 */
const CENTERS: Record<KeypadKey, readonly [number, number]> = {
  '7': [50, 50],
  '8': [150, 50],
  '9': [250, 50],
  '4': [50, 150],
  '5': [150, 150],
  '6': [250, 150],
  '1': [50, 250],
  '2': [150, 250],
  '3': [250, 250],
  '0': [150, 350],
  backspace: [250, 350],
};
const EMPTY_CELL = [50, 350] as const;

describe('Keypad', () => {
  let fixture: ComponentFixture<Keypad>;
  let host: HTMLElement;
  let typed: KeypadKey[];
  let touches: KeypadTouch[];
  let setPointerCapture: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    // jsdom has no layout or pointer capture.
    setPointerCapture = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      value: setPointerCapture,
      configurable: true,
    });
    fixture = TestBed.createComponent(Keypad);
    host = fixture.nativeElement as HTMLElement;
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: -30, y: -20, width: 360, height: 460 }),
    );
    typed = [];
    touches = [];
    // Like the play screen, each digit typed moves its key on to its next color.
    fixture.componentRef.setInput('colors', keyColors(''));
    fixture.componentInstance.touched.subscribe((touch) => {
      touches.push(touch);
      if (touch.key === null) {
        return;
      }
      typed.push(touch.key);
      fixture.componentRef.setInput('colors', keyColors(typed.filter(isDigit).join('')));
    });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const grid = host.querySelector<HTMLElement>('.grid');
    if (grid !== null) {
      vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 400 }),
      );
    }
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
    vi.useRealTimers();
  });

  function button(key: KeypadKey): HTMLButtonElement {
    const element = host.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`);
    if (element === null) {
      throw new Error(`No key for ${key}`);
    }
    return element;
  }

  function pointer(
    type: string,
    [x, y]: readonly [number, number],
    init: PointerEventInit = {},
  ): PointerEvent {
    const event = new PointerEvent(type, {
      clientX: x,
      clientY: y,
      pointerId: 1,
      button: type === 'pointermove' ? -1 : 0,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    // Touches land on whatever is under the finger; the keypad handles them all the same.
    (host.querySelector('button') ?? host).dispatchEvent(event);
    return event;
  }

  function down(key: KeypadKey, pointerId = 1): PointerEvent {
    return pointer('pointerdown', CENTERS[key], { pointerId });
  }

  function up(key: KeypadKey, pointerId = 1): void {
    pointer('pointerup', CENTERS[key], { pointerId });
  }

  function tap(key: KeypadKey, pointerId = 1): void {
    down(key, pointerId);
    up(key, pointerId);
  }

  function keyboard(type: 'keydown' | 'keyup', init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
    document.dispatchEvent(event);
    return event;
  }

  function pressedKeys(): string[] {
    fixture.detectChanges();
    return Array.from(
      host.querySelectorAll<HTMLElement>('.pressed'),
      (key) => key.dataset['key'] ?? '',
    );
  }

  describe('layout', () => {
    it('renders the keys in reading order of the calculator layout', () => {
      const labels = Array.from(host.querySelectorAll('button'), (key) => key.textContent.trim());
      expect(labels).toEqual(['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '']);
    });

    it('renders the keys of the telephone layout, with 1 on top, and types the key touched there', () => {
      fixture.componentRef.setInput('layout', 'telephone');
      fixture.detectChanges();

      const labels = Array.from(host.querySelectorAll('button'), (key) => key.textContent.trim());
      expect(labels).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '']);
      expect([button('1').style.gridRow, button('1').style.gridColumn]).toEqual(['1', '1']);
      // Where 7 is in the calculator layout.
      tap('7');
      expect(typed).toEqual(['1']);
    });

    it('places each key in its grid cell', () => {
      expect([button('7').style.gridRow, button('7').style.gridColumn]).toEqual(['1', '1']);
      expect([button('0').style.gridRow, button('0').style.gridColumn]).toEqual(['4', '2']);
      expect([button('backspace').style.gridRow, button('backspace').style.gridColumn]).toEqual([
        '4',
        '3',
      ]);
    });

    it('is an accessible group of buttons', () => {
      expect(host.getAttribute('role')).toBe('group');
      expect(host.getAttribute('aria-label')).toBe('Keypad');
      expect(button('5').type).toBe('button');
      expect(button('5').getAttribute('aria-label')).toBeNull();
    });

    it('shows backspace as an icon with an accessible name', () => {
      expect(button('backspace').getAttribute('aria-label')).toBe('Delete last digit');
      expect(button('backspace').querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('makes the keys see-through, unless told to make the digit keys solid', () => {
      expect(button('7').classList).toContain('clear');
      expect(button('backspace').classList).toContain('clear');

      fixture.componentRef.setInput('solid', true);
      fixture.detectChanges();

      expect(button('7').classList).not.toContain('clear');
      expect(button('backspace').classList).toContain('clear');
      expect(button('7').style.getPropertyValue('--press-color')).not.toBe('');
    });

    it("shows each key's area when told to, in its cell, in its color", () => {
      expect(host.querySelector('.area')).toBeNull();

      fixture.componentRef.setInput('showAreas', true);
      fixture.detectChanges();

      const areas = host.querySelectorAll<HTMLElement>('.area');
      const seven = host.querySelector<HTMLElement>('.area[data-key="7"]');
      expect(areas.length).toBe(11);
      expect([seven?.style.gridRow, seven?.style.gridColumn]).toEqual(['1', '1']);
      expect(seven?.style.getPropertyValue('--key-color')).toBe(
        button('7').style.getPropertyValue('--press-color'),
      );
      expect(host.querySelector('.areas')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('touch', () => {
    it('types a key when it is released, not when it is pressed', () => {
      down('3');
      expect(typed).toEqual([]);

      up('3');
      expect(typed).toEqual(['3']);
    });

    it('types every key, backspace included', () => {
      for (const key of Object.keys(CENTERS) as KeypadKey[]) {
        tap(key);
      }

      expect(typed).toEqual(Object.keys(CENTERS));
    });

    it('takes over the touch: no default action, and later events come to the keypad', () => {
      const event = down('3');

      expect(event.defaultPrevented).toBe(true);
      expect(setPointerCapture).toHaveBeenCalledWith(1);
    });

    it('still types a key when the finger slides a little within it', () => {
      down('5');
      pointer('pointermove', [180, 120]);
      pointer('pointerup', [195, 105]);

      expect(typed).toEqual(['5']);
    });

    it('types a key touched in the gap next to it or in its corner', () => {
      pointer('pointerdown', [99, 1]);
      pointer('pointerup', [99, 1]);
      pointer('pointerdown', [101, 199]);
      pointer('pointerup', [101, 199]);

      expect(typed).toEqual(['7', '5']);
    });

    it('types the keys on the edges touched beyond them, out to the edges of the keypad', () => {
      for (const point of [
        [-30, 150],
        [329, 150],
        [150, -20],
        [150, 439],
        [329, 439],
      ] as const) {
        pointer('pointerdown', point);
        pointer('pointerup', point);
      }

      expect(typed).toEqual(['4', '6', '8', '0', 'backspace']);
    });

    it('splits the gaps between keys in their middle', () => {
      const grid = host.querySelector<HTMLElement>('.grid');
      grid?.style.setProperty('column-gap', '30px');
      // Keys 80 wide, 30 apart: 7 ends at 80, 8 starts at 110.
      for (const x of [94, 96]) {
        pointer('pointerdown', [x, 50]);
        pointer('pointerup', [x, 50]);
      }

      expect(typed).toEqual(['7', '8']);
    });

    it('still types a key when the finger slides off it, onto the next keys, up to a step beyond its cell', () => {
      down('5');
      pointer('pointermove', CENTERS['6']);
      pointer('pointerup', [299, 150]);
      down('5');
      pointer('pointermove', CENTERS['1']);
      pointer('pointerup', [1, 299]);
      down('5');
      pointer('pointerup', [150, 1]);

      expect(typed).toEqual(['5', '5', '5']);
    });

    it('still types a key released off the keypad, near enough to it', () => {
      down('9');
      pointer('pointerup', [330, 50]);
      down('8');
      pointer('pointerup', [150, -99]);

      expect(typed).toEqual(['9', '8']);
    });

    it('does not type a key when the finger slides more than a step beyond its cell before release', () => {
      down('5');
      pointer('pointermove', [301, 150]);
      pointer('pointerup', [301, 150]);
      down('5');
      pointer('pointermove', CENTERS['0']);
      up('0');

      expect(typed).toEqual([]);
    });

    it('does not type a key released more than a step beyond its cell, without sliding there first', () => {
      down('8');
      pointer('pointerup', [150, -101]);

      expect(typed).toEqual([]);
    });

    it('types a key released near it, even after sliding too far off it: only where it is released counts', () => {
      down('5');
      pointer('pointermove', CENTERS['0']);
      pointer('pointermove', CENTERS['6']);
      up('6');

      expect(typed).toEqual(['5']);
    });

    it('does not type a key released too far off it, even after coming back near it', () => {
      down('5');
      pointer('pointermove', CENTERS['0']);
      pointer('pointermove', CENTERS['5']);
      up('0');

      expect(typed).toEqual([]);
    });

    it('does not type a key whose touch the browser cancels', () => {
      down('9');
      pointer('pointercancel', CENTERS['9']);
      up('9');

      expect(typed).toEqual([]);
    });

    it('ignores touches on the empty cell or beyond it, outside the keypad, and with another mouse button', () => {
      for (const point of [EMPTY_CELL, [-10, 420], [-31, 50]] as const) {
        pointer('pointerdown', point);
        pointer('pointerup', point);
      }
      pointer('pointerdown', CENTERS['7'], { button: 2 });
      pointer('pointerup', CENTERS['7'], { button: 2 });

      expect(typed).toEqual([]);
    });

    it('ignores releases and moves of touches it did not start', () => {
      pointer('pointermove', CENTERS['7'], { pointerId: 9 });
      up('7', 9);

      expect(typed).toEqual([]);
    });

    it('keeps up with fast typing across keys', () => {
      const sequence = '31415926535897932384626433832795028841971693993751'.split(
        '',
      ) as KeypadKey[];

      for (const key of sequence) {
        tap(key);
      }

      expect(typed).toEqual(sequence);
    });

    it('types the same key as many times as it is tapped quickly', () => {
      for (let i = 0; i < 50; i++) {
        tap('8');
        vi.advanceTimersByTime(30);
      }

      expect(typed).toEqual(Array<KeypadKey>(50).fill('8'));
    });

    it('handles overlapping touches from two fingers, typing each key on its own release', () => {
      down('3', 1);
      down('1', 2);
      up('3', 1);
      down('4', 1);
      up('1', 2);
      up('4', 1);

      expect(typed).toEqual(['3', '1', '4']);
    });

    it('types overlapping touches in the order they are released', () => {
      down('3', 1);
      down('1', 2);
      up('1', 2);
      up('3', 1);

      expect(typed).toEqual(['1', '3']);
    });

    it('two fingers on the same key type it twice', () => {
      down('2', 1);
      down('2', 2);
      up('2', 2);
      up('2', 1);

      expect(typed).toEqual(['2', '2']);
    });

    it('treats a new press from the same pointer as a new touch', () => {
      down('3');
      down('1');
      up('1');

      expect(typed).toEqual(['1']);
    });

    it('shows touched keys pressed while releasing would type them: until released (a digit a moment longer) or cancelled', () => {
      down('5', 1);
      down('backspace', 2);
      expect(pressedKeys()).toEqual(['5', 'backspace']);

      up('5', 1);
      expect(pressedKeys()).toEqual(['5', 'backspace']);
      vi.advanceTimersByTime(SPLASH_DURATION);
      expect(pressedKeys()).toEqual(['backspace']);

      pointer('pointermove', CENTERS['3'], { pointerId: 2 });
      expect(pressedKeys()).toEqual(['backspace']);
      pointer('pointermove', CENTERS['6'], { pointerId: 2 });
      expect(pressedKeys()).toEqual([]);
      pointer('pointermove', CENTERS['3'], { pointerId: 2 });
      expect(pressedKeys()).toEqual(['backspace']);
      pointer('pointerup', CENTERS['6'], { pointerId: 2 });

      down('9', 3);
      pointer('pointercancel', CENTERS['9'], { pointerId: 3 });
      expect(pressedKeys()).toEqual([]);
    });
  });

  describe('reporting touches', () => {
    it('reports where each touch started, in steps between keys from the center of 5, wherever it is released', () => {
      tap('7');
      pointer('pointerdown', [175, 125]);
      pointer('pointermove', CENTERS['6']);
      pointer('pointerup', CENTERS['5']);
      tap('0');

      expect(touches).toEqual([
        { key: '7', x: -1, y: -1 },
        { key: '5', x: 0.25, y: -0.25 },
        { key: '0', x: 0, y: 2 },
      ]);
    });

    it('reports the touches that type nothing: on the empty cell, or released too far off their key', () => {
      pointer('pointerdown', EMPTY_CELL);
      pointer('pointerup', EMPTY_CELL);
      down('5');
      pointer('pointermove', CENTERS['0']);
      up('0');
      down('9');
      pointer('pointerup', [250, -120]);

      expect(touches).toEqual([
        { key: null, x: -1, y: 2 },
        { key: null, x: 0, y: 0 },
        { key: null, x: 1, y: -1 },
      ]);
    });

    it('reports a touch that slid off its key but not too far where it started, typing its key', () => {
      down('5');
      pointer('pointerup', CENTERS['6']);

      expect(touches).toEqual([{ key: '5', x: 0, y: 0 }]);
    });

    it('reports nothing of a touch the browser cancels', () => {
      down('9');
      pointer('pointercancel', CENTERS['9']);

      expect(touches).toEqual([]);
    });

    it('reports each repeat of backspace where the touch started, and nothing as it lifts after', () => {
      pointer('pointerdown', [237.5, 337.5]);
      pointer('pointermove', CENTERS.backspace);
      vi.advanceTimersByTime(REPEAT_DELAY + REPEAT_INTERVAL);
      up('backspace');

      expect(touches).toEqual([
        { key: 'backspace', x: 0.875, y: 1.875 },
        { key: 'backspace', x: 0.875, y: 1.875 },
      ]);
    });

    it('reports keys typed on a physical keyboard without a place on the keypad', () => {
      keyboard('keydown', { key: '3' });
      keyboard('keydown', { key: 'Backspace' });

      expect(touches).toEqual([{ key: '3' }, { key: 'backspace' }]);
    });
  });

  describe('replaying', () => {
    function set(name: string, value: unknown): void {
      fixture.componentRef.setInput(name, value);
      fixture.detectChanges();
    }

    it('takes no touches nor keys when disabled', () => {
      set('disabled', true);

      tap('5');
      keyboard('keydown', { key: '3' });
      button('7').dispatchEvent(new MouseEvent('click', { detail: 0 }));

      expect(touches).toEqual([]);
      expect(pressedKeys()).toEqual([]);
    });

    it('shows the key it is told to pressed, filled with the color noted for it', () => {
      const color = button('4').style.getPropertyValue('--press-color');
      fixture.componentInstance.noteColor('4');
      fixture.componentRef.setInput('colors', keyColors('14'));

      set('shown', '4');

      expect(pressedKeys()).toEqual(['4']);
      expect(button('4').style.getPropertyValue('--press-color')).toBe(color);
      set('shown', undefined);
      expect(pressedKeys()).toEqual([]);
    });

    it('marks touches where they were, fading away, those typing nothing as rings', () => {
      set('marks', [
        { id: 0, typed: true, x: -1, y: 0.25, faded: 0.5 },
        { id: 1, typed: false, x: 1.5, y: 2, faded: 0 },
      ]);

      const marks = Array.from(host.querySelectorAll<HTMLElement>('.mark'));
      expect(
        marks.map((mark) => [
          mark.style.getPropertyValue('--x'),
          mark.style.getPropertyValue('--y'),
          mark.style.opacity,
          mark.classList.contains('missed'),
        ]),
      ).toEqual([
        ['-1', '0.25', '0.5', false],
        ['1.5', '2', '1', true],
      ]);
    });
  });

  describe('holding a key', () => {
    it('does not repeat a key held for less than the repeat delay', () => {
      down('backspace');
      vi.advanceTimersByTime(REPEAT_DELAY - 1);
      up('backspace');

      expect(typed).toEqual(['backspace']);
    });

    it('starts typing the key after the repeat delay, then repeats it at the repeat interval', () => {
      down('backspace');
      vi.advanceTimersByTime(REPEAT_DELAY);
      expect(typed).toEqual(['backspace']);

      vi.advanceTimersByTime(REPEAT_INTERVAL * 3);
      expect(typed).toHaveLength(4);
    });

    it('does not type backspace once more on release after repeating', () => {
      down('backspace');
      vi.advanceTimersByTime(REPEAT_DELAY + REPEAT_INTERVAL);
      up('backspace');
      vi.advanceTimersByTime(1000);

      expect(typed).toEqual(['backspace', 'backspace']);
    });

    it('pauses repeating while the finger is too far off backspace, and goes on as it comes back', () => {
      down('backspace');
      vi.advanceTimersByTime(REPEAT_DELAY);
      pointer('pointermove', CENTERS['6']);
      vi.advanceTimersByTime(REPEAT_INTERVAL * 3);
      expect(typed).toEqual(['backspace']);

      pointer('pointermove', CENTERS.backspace);
      vi.advanceTimersByTime(REPEAT_INTERVAL);
      up('backspace');
      expect(typed).toEqual(['backspace', 'backspace']);
    });

    it('does not repeat digits: a long press types the digit once, on release', () => {
      down('7');
      vi.advanceTimersByTime(2000);
      expect(typed).toEqual([]);

      up('7');
      expect(typed).toEqual(['7']);
    });

    it('lets a digit be typed while backspace is held by another finger', () => {
      down('backspace', 1);
      down('2', 2);
      up('2', 2);
      up('backspace', 1);

      expect(typed).toEqual(['2', 'backspace']);
    });

    it('stops repeating when destroyed', () => {
      down('backspace');
      fixture.destroy();
      vi.advanceTimersByTime(1000);

      expect(typed).toEqual([]);
    });
  });

  describe('physical keyboard', () => {
    it('types digits and backspace as they are pressed', () => {
      const event = keyboard('keydown', { key: '4' });
      keyboard('keydown', { key: 'Backspace' });

      expect(typed).toEqual(['4', 'backspace']);
      expect(event.defaultPrevented).toBe(true);
    });

    it('repeats backspace as the keyboard repeats it, but not digits', () => {
      keyboard('keydown', { key: '4' });
      const repeat = keyboard('keydown', { key: '4', repeat: true });
      keyboard('keydown', { key: 'Backspace' });
      keyboard('keydown', { key: 'Backspace', repeat: true });

      expect(typed).toEqual(['4', 'backspace', 'backspace']);
      expect(repeat.defaultPrevented).toBe(true);
    });

    it('lights up keys while they are held down', () => {
      keyboard('keydown', { key: '4' });
      keyboard('keydown', { key: 'Backspace' });
      keyboard('keydown', { key: '4', repeat: true });
      expect(pressedKeys()).toEqual(['4', 'backspace']);

      vi.advanceTimersByTime(SPLASH_DURATION);
      keyboard('keyup', { key: '4' });
      expect(pressedKeys()).toEqual(['backspace']);
    });

    it('lets go of held keys when the window loses focus', () => {
      keyboard('keydown', { key: '4' });
      vi.advanceTimersByTime(SPLASH_DURATION);
      window.dispatchEvent(new Event('blur'));

      expect(pressedKeys()).toEqual([]);
    });

    it.each<[string, KeyboardEventInit]>([
      ['other keys', { key: 'a' }],
      ['Delete', { key: 'Delete' }],
      ['Ctrl shortcuts', { key: '4', ctrlKey: true }],
      ['Meta shortcuts', { key: '4', metaKey: true }],
      ['Alt shortcuts', { key: 'Backspace', altKey: true }],
    ])('ignores %s', (_, init) => {
      const event = keyboard('keydown', init);
      keyboard('keyup', init);

      expect(typed).toEqual([]);
      expect(event.defaultPrevented).toBe(false);
      expect(pressedKeys()).toEqual([]);
    });

    it('types a key activated by assistive technology, keys taking no focus', () => {
      button('6').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

      expect(typed).toEqual(['6']);
      expect([button('6').tabIndex, button('backspace').tabIndex]).toEqual([-1, -1]);
    });

    it('ignores the click that follows a touch, which is already handled', () => {
      tap('6');
      button('6').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));

      expect(typed).toEqual(['6']);
    });
  });

  describe('colors', () => {
    /** The color a key shows on its edge, and fills with while pressed. */
    function accent(key: KeypadKey): string {
      fixture.detectChanges();
      return button(key).style.getPropertyValue('--press-color');
    }

    /** The color a key is filled with, or `null` when it isn't. */
    function splash(key: KeypadKey): string | null {
      const color = accent(key);
      return button(key).classList.contains('pressed') ? color || null : null;
    }

    it('shows each digit key its color on its edge, and backspace none', () => {
      expect(['0', '1', '9'].map((key) => accent(key as KeypadKey))).toEqual([
        PALETTE[0],
        PALETTE[1],
        PALETTE[9],
      ]);
      expect(accent('backspace')).toBe('');
    });

    it('fills a key with its color as soon as it is touched', () => {
      down('3');

      expect(splash('3')).toBe(PALETTE[3]);
      expect(splash('4')).toBeNull();
    });

    it('keeps the color the digit took once released, for a moment, then shows the next one', () => {
      tap('3');

      expect(splash('3')).toBe(PALETTE[3]);

      vi.advanceTimersByTime(SPLASH_DURATION - 1);
      expect(splash('3')).toBe(PALETTE[3]);

      vi.advanceTimersByTime(1);
      expect(splash('3')).toBeNull();
      expect(accent('3')).toBe(PALETTE[4]);
    });

    it('stays filled while held for longer', () => {
      down('3');
      vi.advanceTimersByTime(SPLASH_DURATION * 3);

      expect(splash('3')).toBe(PALETTE[3]);

      up('3');
      expect(splash('3')).toBeNull();
    });

    it('fills a key tapped again quickly with its new color', () => {
      tap('3');
      vi.advanceTimersByTime(SPLASH_DURATION / 2);
      down('3');

      expect(splash('3')).toBe(PALETTE[4]);
    });

    it('keeps a key filled while the finger slides off it, but not too far, and fills it again as it comes back', () => {
      down('5');
      pointer('pointermove', CENTERS['6']);
      expect(splash('5')).toBe(PALETTE[5]);

      pointer('pointermove', CENTERS['0']);
      pointer('pointermove', CENTERS['5']);
      expect(splash('5')).toBe(PALETTE[5]);
    });

    it('empties a key at once when the finger slides too far off it or the browser cancels the touch', () => {
      down('5');
      pointer('pointermove', CENTERS['0']);
      expect(splash('5')).toBeNull();

      down('9');
      pointer('pointercancel', CENTERS['9']);
      expect(splash('9')).toBeNull();
    });

    it('fills a key typed on a physical keyboard with the color its digit took', () => {
      keyboard('keydown', { key: '7' });

      expect(splash('7')).toBe(PALETTE[7]);

      keyboard('keydown', { key: '7', repeat: true });
      expect(splash('7')).toBe(PALETTE[7]);

      vi.advanceTimersByTime(SPLASH_DURATION);
      keyboard('keyup', { key: '7' });
      expect(splash('7')).toBeNull();
      expect(accent('7')).toBe(PALETTE[8]);
    });

    it('never fills backspace', () => {
      down('backspace');
      expect(splash('backspace')).toBeNull();

      keyboard('keydown', { key: 'Backspace' });
      expect(splash('backspace')).toBeNull();
    });
  });
});
