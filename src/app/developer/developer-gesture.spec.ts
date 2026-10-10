import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { INDEXED_DB } from '../runs/run-store';
import {
  CELEBRATION_MS,
  DeveloperGesture,
  HOLD_MS,
  isOnTarget,
  MESSAGES,
  targetIn,
} from './developer-gesture';
import { DeveloperMode } from './developer-mode';
import { DeveloperOverlay } from './developer-overlay';

@Component({
  imports: [DeveloperGesture, DeveloperOverlay],
  template: `
    <app-developer-overlay [gesture]="gesture" />
    <button #gesture="developerGesture" appDeveloperGesture type="button" (click)="tap($event)">
      More
    </button>
  `,
})
class Host {
  /** Taps the button acted on: the gesture cancels the click that follows it, as for the overflow menu's popover. */
  taps = 0;

  tap(event: MouseEvent): void {
    // The gesture's own listener may run after this one: wait for it.
    queueMicrotask(() => {
      if (!event.defaultPrevented) {
        this.taps++;
      }
    });
  }
}

describe('targetIn', () => {
  it('puts the target in the middle, near the bottom of the window', () => {
    expect(targetIn(400, 800)).toEqual({ x: 200, y: 716, radius: 44 });
  });
});

describe('isOnTarget', () => {
  const target = { x: 200, y: 700, radius: 44 };

  it('takes points on the target, with a little give', () => {
    expect(isOnTarget({ x: 200, y: 700 }, target)).toBe(true);
    expect(isOnTarget({ x: 200, y: 755 }, target)).toBe(true);
    expect(isOnTarget({ x: 200, y: 757 }, target)).toBe(false);
    expect(isOnTarget({ x: 100, y: 700 }, target)).toBe(false);
  });
});

describe('DeveloperGesture', () => {
  // The window's size in the tests, and where the target sits in it.
  const target = targetIn(window.innerWidth, window.innerHeight);
  const start = { x: window.innerWidth - 30, y: 30 };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    TestBed.configureTestingModule({ providers: [{ provide: INDEXED_DB, useValue: undefined }] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setUp(): {
    host: Host;
    button: HTMLButtonElement;
    message: () => string;
    shown: () => boolean;
    targetShown: () => boolean;
    render: () => void;
  } {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector('button');
    const overlay = element.querySelector('app-developer-overlay');
    if (button === null || overlay === null) {
      throw new Error('Nothing rendered');
    }
    const render = (): void => {
      fixture.detectChanges();
    };
    return {
      host: fixture.componentInstance,
      button,
      message: () => {
        render();
        return overlay.querySelector('[role="status"]')?.textContent.trim() ?? '';
      },
      shown: () => {
        render();
        return overlay.classList.contains('shown');
      },
      targetShown: () => {
        render();
        return overlay.querySelector('.target')?.classList.contains('shown') ?? false;
      },
      render,
    };
  }

  function pointer(button: HTMLElement, type: string, at: { x: number; y: number }): void {
    button.dispatchEvent(
      new PointerEvent(type, { bubbles: true, isPrimary: true, clientX: at.x, clientY: at.y }),
    );
  }

  /** Holds the button long enough and drags it to a point, without letting go. */
  function holdAndDrag(button: HTMLElement, to: { x: number; y: number }): void {
    pointer(button, 'pointerdown', start);
    vi.advanceTimersByTime(HOLD_MS);
    pointer(button, 'pointermove', to);
  }

  function release(button: HTMLElement, at: { x: number; y: number }): void {
    pointer(button, 'pointerup', at);
    button.click();
  }

  it('turns developer mode on when the held button is dropped on the target', () => {
    const { button, message, targetShown } = setUp();
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });

    pointer(button, 'pointerdown', start);
    vi.advanceTimersByTime(HOLD_MS - 1);
    expect(targetShown()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(vibrate).toHaveBeenCalledOnce();
    expect(targetShown()).toBe(true);
    expect(message()).toBe(MESSAGES.on.dragging);

    pointer(button, 'pointermove', { x: target.x, y: target.y - 20 });
    expect(message()).toBe(MESSAGES.on.onTarget);
    expect(button.style.translate).toBe(
      `${String(target.x - start.x)}px ${String(target.y - 20 - start.y)}px`,
    );

    release(button, target);
    expect(TestBed.inject(DeveloperMode).enabled()).toBe(true);
    expect(message()).toBe(MESSAGES.on.done);
    expect(button.style.translate).toBe('');
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('shows its closing message for a while, then goes away', () => {
    const { button, message, shown } = setUp();

    holdAndDrag(button, target);
    release(button, target);
    vi.advanceTimersByTime(CELEBRATION_MS - 1);
    expect(shown()).toBe(true);
    vi.advanceTimersByTime(1);

    expect(shown()).toBe(false);
    expect(message()).toBe('');
  });

  it('turns developer mode back off with the same gesture', async () => {
    const developerMode = TestBed.inject(DeveloperMode);
    await developerMode.set(true);
    const { button, message } = setUp();

    holdAndDrag(button, target);
    expect(message()).toBe(MESSAGES.off.onTarget);
    release(button, target);

    expect(developerMode.enabled()).toBe(false);
    expect(message()).toBe(MESSAGES.off.done);
  });

  it('does what a tap does after a short press', async () => {
    const { host, button, shown } = setUp();

    pointer(button, 'pointerdown', start);
    vi.advanceTimersByTime(HOLD_MS / 2);
    release(button, start);
    vi.advanceTimersByTime(HOLD_MS);
    await Promise.resolve();

    expect(host.taps).toBe(1);
    expect(shown()).toBe(false);
  });

  it('gives up when the finger moves before the button was held long enough', () => {
    const { button, shown } = setUp();

    pointer(button, 'pointerdown', start);
    pointer(button, 'pointermove', { x: start.x, y: start.y + 20 });
    vi.advanceTimersByTime(HOLD_MS);

    expect(shown()).toBe(false);
    pointer(button, 'pointermove', target);
    pointer(button, 'pointerup', target);
    expect(TestBed.inject(DeveloperMode).enabled()).toBe(false);
  });

  it('gives up, without tapping, when the button is dropped anywhere else', async () => {
    const { host, button, shown } = setUp();

    holdAndDrag(button, target);
    pointer(button, 'pointermove', { x: target.x, y: target.y - 200 });
    release(button, { x: target.x, y: target.y - 200 });
    await Promise.resolve();

    expect(TestBed.inject(DeveloperMode).enabled()).toBe(false);
    expect(shown()).toBe(false);
    expect(button.style.translate).toBe('');
    expect(host.taps).toBe(0);
  });

  it('gives up when the browser takes the pointer away', () => {
    const { button, shown } = setUp();

    holdAndDrag(button, target);
    pointer(button, 'pointercancel', target);

    expect(shown()).toBe(false);
    expect(TestBed.inject(DeveloperMode).enabled()).toBe(false);
  });

  it('keeps the long-press menu from opening on the button', () => {
    const { button } = setUp();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    button.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
