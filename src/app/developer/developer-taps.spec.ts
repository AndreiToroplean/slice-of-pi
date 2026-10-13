import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { INDEXED_DB } from '../runs/run-store';
import { DeveloperMode } from './developer-mode';
import { DeveloperTaps, MESSAGE_MS, MESSAGES, TAP_GAP_MS, TAPS } from './developer-taps';

@Component({
  imports: [DeveloperTaps],
  template: `
    <button #taps="developerTaps" appDeveloperTaps type="button">Icon</button>
    <p [class.shown]="taps.shown()">{{ taps.message() }}</p>
  `,
})
class Host {}

describe('DeveloperTaps', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    TestBed.configureTestingModule({ providers: [{ provide: INDEXED_DB, useValue: undefined }] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setUp(): { tap: (times?: number) => void; message: () => string } {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector('button');
    const paragraph = element.querySelector('p');
    if (button === null || paragraph === null) {
      throw new Error('Nothing rendered');
    }
    return {
      tap: (times = 1) => {
        for (let i = 0; i < times; i++) {
          vi.advanceTimersByTime(TAP_GAP_MS - 1);
          button.click();
        }
      },
      message: () => {
        fixture.detectChanges();
        return paragraph.classList.contains('shown') ? paragraph.textContent.trim() : '';
      },
    };
  }

  it('turns developer mode on after ten taps in a row, saying so along the way', () => {
    const { tap, message } = setUp();
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });

    tap(4);
    expect(message()).toBe('');
    tap();
    expect(message()).toBe(MESSAGES.on.counting);
    tap(4);
    expect(message()).toBe(MESSAGES.on.counting);
    expect(TestBed.inject(DeveloperMode).enabled()).toBe(false);
    tap();

    expect(TestBed.inject(DeveloperMode).enabled()).toBe(true);
    expect(vibrate).toHaveBeenCalledOnce();
    expect(message()).toBe(MESSAGES.on.done);
    vi.advanceTimersByTime(MESSAGE_MS);
    expect(message()).toBe('');
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('turns developer mode back off with ten more taps', async () => {
    const developerMode = TestBed.inject(DeveloperMode);
    await developerMode.set(true);
    const { tap, message } = setUp();

    tap(TAPS - 1);
    expect(message()).toBe(MESSAGES.off.counting);
    tap();

    expect(developerMode.enabled()).toBe(false);
    expect(message()).toBe(MESSAGES.off.done);
  });

  it('gives up when the taps slow down, quietly before the fifth', () => {
    const { tap, message } = setUp();

    tap(4);
    vi.advanceTimersByTime(TAP_GAP_MS);
    expect(message()).toBe('');
    tap(TAPS - 4);

    expect(TestBed.inject(DeveloperMode).enabled()).toBe(false);
    expect(message()).toBe(MESSAGES.on.counting);
  });

  it('says a word about stopping short, depending on how far the taps went', () => {
    const { tap, message } = setUp();

    tap(9);
    vi.advanceTimersByTime(TAP_GAP_MS);

    expect(message()).toBe(MESSAGES.on.stopped[9]);
    expect(TestBed.inject(DeveloperMode).enabled()).toBe(false);
    vi.advanceTimersByTime(MESSAGE_MS);
    expect(message()).toBe('');
  });

  it('says another word about stopping short of turning developer mode off', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    const { tap, message } = setUp();

    tap(6);
    vi.advanceTimersByTime(TAP_GAP_MS);

    expect(message()).toBe(MESSAGES.off.stopped[6]);
    expect(TestBed.inject(DeveloperMode).enabled()).toBe(true);
  });
});
