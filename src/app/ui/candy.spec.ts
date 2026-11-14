import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Candy, SHORTEST_PRESS, SWIPE_SLOP } from './candy';

@Component({
  imports: [Candy],
  template: `
    <button type="button" appCandy>White</button>
    <a appCandy="primary" href="/">Primary</a>
    <label appCandy="danger">Danger <input type="file" /></label>
    <button type="button" appCandy="clear">Clear</button>
    <button
      type="button"
      appCandy="clear"
      [focusable]="false"
      pressColor="#123456"
      [pressed]="pressed()"
    >
      Key
    </button>
    <button type="button" appCandy [swipeWait]="100">Swiped</button>
  `,
})
class Host {
  readonly pressed = signal(false);
}

describe('Candy', () => {
  async function setUp(): Promise<{
    candies: HTMLElement[];
    press: (pressed: boolean) => Promise<void>;
  }> {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return {
      candies: Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.candy')),
      press: async (pressed) => {
        fixture.componentInstance.pressed.set(pressed);
        await fixture.whenStable();
      },
    };
  }

  it(
    'makes a button, a link or a label a candy button, white unless given a look, or see-through',
    { tags: ['disabled'] },
    async () => {
      const [white, primary, danger, clear] = (await setUp()).candies;

      expect(white?.classList.value).toBe('candy');
      expect(primary?.classList).toContain('primary');
      expect(danger?.classList).toContain('danger');
      expect(danger?.classList).not.toContain('primary');
      expect(clear?.classList).toContain('clear');
    },
  );

  it('takes the focus unless told not to', async () => {
    const [white, , , , key] = (await setUp()).candies;

    expect(white?.hasAttribute('tabindex')).toBe(false);
    expect(white?.classList).not.toContain('unfocusable');
    expect(key?.tabIndex).toBe(-1);
    expect(key?.classList).toContain('unfocusable');
  });

  it('shows its press color, and shows pressed when told to', { tags: ['disabled'] }, async () => {
    const { candies, press } = await setUp();
    const [white, , , , key] = candies;
    expect(white?.classList).not.toContain('colored');
    expect(key?.classList).toContain('colored');
    expect(key?.style.getPropertyValue('--press-color')).toBe('#123456');
    expect(key?.classList).not.toContain('pressed');

    await press(true);

    expect(key?.classList).toContain('pressed');
  });

  it('shows pressed while pressed, and long enough to sink all the way however quick the press', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    try {
      const fixture = TestBed.createComponent(Host);
      await fixture.whenStable();
      const [white, , , , key] = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.candy'),
      );
      const pressed = (): boolean | undefined => {
        fixture.detectChanges();
        return white?.classList.contains('pressed');
      };

      white?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(pressed()).toBe(true);
      vi.advanceTimersByTime(SHORTEST_PRESS / 3);
      document.dispatchEvent(new PointerEvent('pointerup'));
      expect(pressed()).toBe(true);

      vi.advanceTimersByTime((SHORTEST_PRESS * 2) / 3 - 1);
      expect(pressed()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(pressed()).toBe(false);

      // One told whether it's pressed only shows that.
      key?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      fixture.detectChanges();
      expect(key?.classList).not.toContain('pressed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits to tell a swipe from a press, showing none for a swipe', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    try {
      const fixture = TestBed.createComponent(Host);
      await fixture.whenStable();
      const swiped = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.candy'),
      ).at(-1);
      const pressed = (): boolean | undefined => {
        fixture.detectChanges();
        return swiped?.classList.contains('pressed');
      };
      const touch = (type: string, x = 0, target: EventTarget | undefined = swiped): void => {
        target?.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x }));
      };
      // It never shows the browser's own press, which doesn't wait.
      expect(swiped?.classList).toContain('controlled');

      // Held still past the wait, a press.
      touch('pointerdown');
      expect(pressed()).toBe(false);
      vi.advanceTimersByTime(100);
      expect(pressed()).toBe(true);
      touch('pointerup', 0, document);
      vi.advanceTimersByTime(SHORTEST_PRESS);
      expect(pressed()).toBe(false);

      // Wandering, a swipe.
      touch('pointerdown');
      touch('pointermove', SWIPE_SLOP + 1);
      vi.advanceTimersByTime(100);
      expect(pressed()).toBe(false);
      touch('pointerup', 0, document);

      // Taken over by the browser to scroll, a swipe.
      touch('pointerdown');
      touch('pointercancel', 0, document);
      vi.advanceTimersByTime(100);
      expect(pressed()).toBe(false);

      // Let go before the wait is over, a press all the same, as long as any.
      touch('pointerdown');
      vi.advanceTimersByTime(30);
      touch('pointerup', 0, document);
      expect(pressed()).toBe(true);
      vi.advanceTimersByTime(SHORTEST_PRESS - 1);
      expect(pressed()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(pressed()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
