import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Keypad } from './keypad';
import { KeypadKey } from './keypad-layout';

describe('Keypad', () => {
  let fixture: ComponentFixture<Keypad>;
  let pressed: KeypadKey[];
  let animate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // jsdom does not implement the Web Animations API.
    animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });

    fixture = TestBed.createComponent(Keypad);
    pressed = [];
    fixture.componentInstance.keyPressed.subscribe((key) => pressed.push(key));
    await fixture.whenStable();
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });

  function button(key: KeypadKey): HTMLButtonElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      `button[data-key="${key}"]`,
    );
    if (element === null) {
      throw new Error(`No key for ${key}`);
    }
    return element;
  }

  function keydown(init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    return event;
  }

  it('renders the keys in reading order of the calculator layout', () => {
    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).map((key) => key.textContent.trim());
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
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('role')).toBe('group');
    expect(host.getAttribute('aria-label')).toBe('Keypad');
    expect(button('5').type).toBe('button');
    expect(button('5').getAttribute('aria-label')).toBeNull();
  });

  it('shows backspace as an icon with an accessible name', () => {
    expect(button('backspace').getAttribute('aria-label')).toBe('Delete last digit');
    expect(button('backspace').querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('emits the digit of a clicked key and animates it', () => {
    button('3').click();
    button('1').click();

    expect(pressed).toEqual(['3', '1']);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.contexts[0]).toBe(button('3'));
    expect(animate.mock.contexts[1]).toBe(button('1'));
  });

  it('emits backspace when its key is clicked', () => {
    button('backspace').click();

    expect(pressed).toEqual(['backspace']);
    expect(animate.mock.contexts[0]).toBe(button('backspace'));
  });

  it('emits backspace for the physical Backspace key, repeating while it is held', () => {
    const event = keydown({ key: 'Backspace' });
    keydown({ key: 'Backspace', repeat: true });

    expect(pressed).toEqual(['backspace', 'backspace']);
    expect(event.defaultPrevented).toBe(true);
    expect(animate.mock.contexts[0]).toBe(button('backspace'));
  });

  it('emits digits typed on a physical keyboard and animates their keys', () => {
    const event = keydown({ key: '4' });

    expect(pressed).toEqual(['4']);
    expect(event.defaultPrevented).toBe(true);
    expect(animate.mock.contexts[0]).toBe(button('4'));
  });

  it.each<[string, KeyboardEventInit]>([
    ['a non-digit key', { key: 'a' }],
    ['a held-down digit repeating', { key: '4', repeat: true }],
    ['the Delete key', { key: 'Delete' }],
    ['a Ctrl shortcut with Backspace', { key: 'Backspace', ctrlKey: true }],
    ['a Ctrl shortcut', { key: '4', ctrlKey: true }],
    ['a Meta shortcut', { key: '4', metaKey: true }],
    ['an Alt shortcut', { key: '4', altKey: true }],
  ])('ignores %s', (_, init) => {
    const event = keydown(init);

    expect(pressed).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
    expect(animate).not.toHaveBeenCalled();
  });
});
