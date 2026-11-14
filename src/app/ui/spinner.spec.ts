import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Vibrator } from '../feedback/vibrator';
import { pressKey } from '../../testing/keys';
import { SPIN_DISTANCE, spun, Spinner } from './spinner';

@Component({
  imports: [Spinner],
  template: `
    <button type="button" (click)="clicks.set(clicks() + 1)">
      <app-spinner label="Size" [min]="0" [max]="50" [step]="10" [(value)]="value" />
    </button>
  `,
})
class Host {
  readonly value = signal(20);
  readonly clicks = signal(0);
}

describe('spun', () => {
  it('steps the value once for each little way up or down, back to where it started', () => {
    expect(spun(20, SPIN_DISTANCE - 1, 10, 0, 50)).toBe(20);
    expect(spun(20, SPIN_DISTANCE, 10, 0, 50)).toBe(30);
    expect(spun(20, 2 * SPIN_DISTANCE + 5, 10, 0, 50)).toBe(40);
    expect(spun(20, -SPIN_DISTANCE, 10, 0, 50)).toBe(10);
    expect(spun(20, 0, 10, 0, 50)).toBe(20);
  });

  it('stays within its ends', () => {
    expect(spun(20, 10 * SPIN_DISTANCE, 10, 0, 50)).toBe(50);
    expect(spun(20, -10 * SPIN_DISTANCE, 10, 0, 50)).toBe(0);
  });
});

describe('Spinner', () => {
  beforeEach(() => {
    // Not in the test browser.
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
  });

  async function setUp(): Promise<{
    host: Host;
    spinner: HTMLElement;
    stable: () => Promise<void>;
  }> {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const spinner = (fixture.nativeElement as HTMLElement).querySelector('app-spinner');
    if (!(spinner instanceof HTMLElement)) {
      throw new Error('No spinner');
    }
    return { host: fixture.componentInstance, spinner, stable: () => fixture.whenStable() };
  }

  function pointer(target: HTMLElement, type: string, clientY: number, clientX = 100): void {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX,
        clientY,
      }),
    );
  }

  it('is a spin button showing its value', async () => {
    const { spinner } = await setUp();

    expect(spinner.getAttribute('role')).toBe('spinbutton');
    expect(spinner.getAttribute('aria-valuenow')).toBe('20');
    expect(spinner.querySelector('.shown')?.textContent.trim()).toBe('20');
  });

  it('follows a drag up and down, a tick of vibration at each step, without clicking what holds it', async () => {
    const vibrate = vi.spyOn(TestBed.inject(Vibrator), 'play');
    const { host, spinner, stable } = await setUp();

    pointer(spinner, 'pointerdown', 200);
    pointer(spinner, 'pointermove', 200 - SPIN_DISTANCE);
    pointer(spinner, 'pointermove', 200 - 2 * SPIN_DISTANCE);
    expect(host.value()).toBe(40);
    pointer(spinner, 'pointermove', 200 - SPIN_DISTANCE);
    pointer(spinner, 'pointermove', 200);
    expect(host.value()).toBe(20);
    pointer(spinner, 'pointerup', 200);
    spinner.click();
    await stable();

    expect(vibrate.mock.calls.filter(([vibration]) => vibration === 'spin')).toHaveLength(4);
    expect(host.clicks()).toBe(0);
  });

  it('follows a drag across as up and down, right raising it, both ways at once adding up', async () => {
    const { host, spinner } = await setUp();

    pointer(spinner, 'pointerdown', 200, 100);
    pointer(spinner, 'pointermove', 200, 100 + SPIN_DISTANCE);
    expect(host.value()).toBe(30);
    pointer(spinner, 'pointermove', 200, 100 - SPIN_DISTANCE);
    expect(host.value()).toBe(10);
    // Half a step up and half a step right make one.
    pointer(spinner, 'pointermove', 200 - SPIN_DISTANCE / 2, 100 + SPIN_DISTANCE / 2);
    expect(host.value()).toBe(30);
    // Up and left cancel out.
    pointer(spinner, 'pointermove', 200 - SPIN_DISTANCE, 100 - SPIN_DISTANCE);
    expect(host.value()).toBe(20);
  });

  it('lets a tap click what holds it', async () => {
    const { host, spinner } = await setUp();

    pointer(spinner, 'pointerdown', 200);
    pointer(spinner, 'pointermove', 202);
    pointer(spinner, 'pointerup', 202);
    spinner.click();

    expect(host.value()).toBe(20);
    expect(host.clicks()).toBe(1);
  });

  it('steps with the arrow keys, and goes to its ends with Home and End', async () => {
    const { host, spinner } = await setUp();

    pressKey('ArrowUp', spinner);
    expect(host.value()).toBe(30);
    pressKey('ArrowDown', spinner);
    pressKey('ArrowDown', spinner);
    expect(host.value()).toBe(10);
    pressKey('End', spinner);
    expect(host.value()).toBe(50);
    pressKey('ArrowUp', spinner);
    expect(host.value()).toBe(50);
    pressKey('Home', spinner);
    expect(host.value()).toBe(0);
  });
});
