import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Keypad, REPEAT_DELAY, REPEAT_INTERVAL } from './keypad';
import { KeypadKey } from './keypad-layout';

/** Center of each key's cell on the 300 × 400 keypad used here (100 × 100 cells). */
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
      DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 400 }),
    );
    typed = [];
    fixture.componentInstance.keyPressed.subscribe((key) => typed.push(key));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
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

    it('does not type a key when the finger slides off it before release', () => {
      down('5');
      pointer('pointermove', CENTERS['6']);
      up('6');

      expect(typed).toEqual([]);
    });

    it('does not type a key when the finger slides off and back onto it', () => {
      down('5');
      pointer('pointermove', CENTERS['6']);
      pointer('pointermove', CENTERS['5']);
      up('5');

      expect(typed).toEqual([]);
    });

    it('does not type a key released outside the keypad', () => {
      down('9');
      pointer('pointerup', [350, 50]);

      expect(typed).toEqual([]);
    });

    it('does not type a key whose touch the browser cancels', () => {
      down('9');
      pointer('pointercancel', CENTERS['9']);
      up('9');

      expect(typed).toEqual([]);
    });

    it('ignores touches on the empty cell, outside the keypad, and with another mouse button', () => {
      pointer('pointerdown', EMPTY_CELL);
      pointer('pointerup', EMPTY_CELL);
      pointer('pointerdown', [-5, 50]);
      pointer('pointerup', [-5, 50]);
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

    it('shows touched keys pressed until released, cancelled or slid off', () => {
      down('5', 1);
      down('backspace', 2);
      expect(pressedKeys()).toEqual(['5', 'backspace']);

      up('5', 1);
      expect(pressedKeys()).toEqual(['backspace']);

      pointer('pointermove', CENTERS['3'], { pointerId: 2 });
      expect(pressedKeys()).toEqual([]);

      down('9', 3);
      pointer('pointercancel', CENTERS['9'], { pointerId: 3 });
      expect(pressedKeys()).toEqual([]);
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

    it('stops repeating when the finger slides off backspace', () => {
      down('backspace');
      vi.advanceTimersByTime(REPEAT_DELAY);
      pointer('pointermove', CENTERS['3']);
      vi.advanceTimersByTime(1000);
      up('3');

      expect(typed).toEqual(['backspace']);
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

      keyboard('keyup', { key: '4' });
      expect(pressedKeys()).toEqual(['backspace']);
    });

    it('lets go of held keys when the window loses focus', () => {
      keyboard('keydown', { key: '4' });
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

    it('types a focused key activated with Enter or Space, or by assistive technology', () => {
      button('6').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

      expect(typed).toEqual(['6']);
    });

    it('ignores the click that follows a touch, which is already handled', () => {
      tap('6');
      button('6').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));

      expect(typed).toEqual(['6']);
    });
  });
});
