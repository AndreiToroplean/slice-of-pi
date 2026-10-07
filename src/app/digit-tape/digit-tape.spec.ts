import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeResizeObserver } from '../../testing/fake-resize-observer';
import { DigitTape } from './digit-tape';
import { tapeGeometry } from './perspective';

const WIDTH = 390;
const HEIGHT = 500;
const GEOMETRY = tapeGeometry(WIDTH, HEIGHT);

describe('DigitTape', () => {
  let fixture: ComponentFixture<DigitTape>;
  let host: HTMLElement;
  let setPointerCapture: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    FakeResizeObserver.install();
    // jsdom does not implement pointer capture.
    setPointerCapture = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      value: setPointerCapture,
      configurable: true,
    });
    vi.useFakeTimers();
    fixture = TestBed.createComponent(DigitTape);
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Lets rendering and the slide animation run for `ms` milliseconds. */
  async function run(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  async function show(digits: string): Promise<void> {
    fixture.componentRef.setInput('digits', digits);
    await run(1000);
  }

  async function showSized(digits: string): Promise<void> {
    fixture.componentRef.setInput('digits', digits);
    await run(0);
    FakeResizeObserver.resizeAll(WIDTH, HEIGHT);
    await run(1000);
  }

  /** Rows as rendered, main row first. */
  function rows(): HTMLElement[] {
    return Array.from(host.querySelectorAll<HTMLElement>('.row')).reverse();
  }

  function rowText(row: HTMLElement | undefined): string {
    return Array.from(row?.querySelectorAll('.digit') ?? [])
      .map((digit) => digit.textContent)
      .join('');
  }

  function translateX(element: Element | null | undefined): number {
    const match = /translateX\((-?[\d.e-]+)px\)/.exec(
      (element as HTMLElement | null | undefined)?.style.transform ?? '',
    );
    return Number(match?.[1]);
  }

  function newest(): HTMLElement | null {
    return host.querySelector<HTMLElement>('.newest');
  }

  it('draws no digits until it knows its size', async () => {
    await show('314');

    expect(host.querySelector('.rows')).toBeNull();
  });

  it('observes its own size', async () => {
    await show('');

    expect(FakeResizeObserver.instances[0]?.observed).toEqual([host]);
  });

  it('draws one row per visible row of the geometry, sized to it', async () => {
    await showSized('');

    expect(rows()).toHaveLength(GEOMETRY.rows.length);
    expect(rows()[1]?.style.transform).toBe(`scale(${String(GEOMETRY.rows[1]?.scale)})`);
    expect(rows()[1]?.style.opacity).toBe(String(GEOMETRY.rows[1]?.opacity));
  });

  it('puts the newest digit in the center of the main row, older ones to its left', async () => {
    await showSized('31415');

    expect(rowText(rows()[0])).toBe('31415');
    expect(newest()?.textContent).toBe('5');
    expect(translateX(newest())).toBeCloseTo(GEOMETRY.centerColumn * GEOMETRY.cellWidth);
  });

  it('wraps older digits onto the rows behind', async () => {
    const columns = GEOMETRY.columns;
    const digits = '0123456789'.repeat(5);
    await showSized(digits);

    const mainCount = GEOMETRY.centerColumn + 1;
    expect(rowText(rows()[0])).toBe(digits.slice(-mainCount));
    expect(rowText(rows()[1])).toBe(digits.slice(-mainCount - columns, -mainCount));
  });

  it('slides smoothly to a newly typed digit', async () => {
    await showSized('3141');

    fixture.componentRef.setInput('digits', '31415');
    await run(20);
    const center = GEOMETRY.centerColumn * GEOMETRY.cellWidth;
    const midway = translateX(newest());
    expect(midway).toBeGreaterThan(center);
    expect(midway).toBeLessThan(center + GEOMETRY.cellWidth);

    await run(1000);
    expect(translateX(newest())).toBeCloseTo(center);
  });

  it('marks only the newest digit, which pops in', async () => {
    await showSized('31415');

    expect(host.querySelectorAll('.newest')).toHaveLength(1);
  });

  it('keeps only visible digits in the DOM however many are typed', async () => {
    await showSized('7'.repeat(100_000));

    const visible = GEOMETRY.rows.length * (GEOMETRY.columns + 1);
    expect(host.querySelectorAll('.digit').length).toBeLessThanOrEqual(visible);
  });

  it('follows size changes', async () => {
    await showSized('31415');

    FakeResizeObserver.resizeAll(1280, 450);
    await run(0);

    expect(rows()).toHaveLength(tapeGeometry(1280, 450).rows.length);
  });

  it('summarizes the digits for assistive technology, and hides the drawing', async () => {
    await showSized('');
    expect(host.querySelector('.visually-hidden')?.textContent).toBe('No digits typed yet.');

    await show('314');
    expect(host.querySelector('.visually-hidden')?.textContent).toBe(
      '3 digits typed, the last one is 4.',
    );
    expect(host.querySelector('.rows')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('stops observing and animating when destroyed', async () => {
    await showSized('3141');
    fixture.componentRef.setInput('digits', '31415');
    await run(0);
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');

    fixture.destroy();

    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
    expect(cancel).toHaveBeenCalled();
  });

  describe('scrolling', () => {
    const DIGITS = '0123456789'.repeat(3);
    const NEWEST = DIGITS.length - 1;
    const CELL = GEOMETRY.cellWidth;

    /** Position the view is centered on, read from where a digit of the main row is drawn. */
    function head(): number {
      const digit = rows()[0]?.querySelector<HTMLElement>('.digit');
      return (
        Number(digit?.dataset['position']) - (translateX(digit) / CELL - GEOMETRY.centerColumn)
      );
    }

    function pointer(type: string, clientX: number, init: PointerEventInit = {}): void {
      host.dispatchEvent(
        new PointerEvent(type, {
          clientX,
          pointerId: 1,
          isPrimary: true,
          button: 0,
          bubbles: true,
          ...init,
        }),
      );
    }

    async function dragBy(cells: number, init: PointerEventInit = {}): Promise<void> {
      pointer('pointerdown', 200, init);
      pointer('pointermove', 200 + cells * CELL, init);
      await run(0);
    }

    async function release(): Promise<void> {
      pointer('pointerup', 0);
      await run(1000);
    }

    function wheel(init: WheelEventInit): WheelEvent {
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
      host.dispatchEvent(event);
      return event;
    }

    function key(init: KeyboardEventInit): KeyboardEvent {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      document.dispatchEvent(event);
      return event;
    }

    beforeEach(async () => {
      await showSized(DIGITS);
    });

    it('follows a sideways drag exactly, dragging right bringing older digits into view', async () => {
      await dragBy(2.5);

      expect(head()).toBeCloseTo(NEWEST - 2.5);
      expect(setPointerCapture).toHaveBeenCalledWith(1);
    });

    it('settles on the nearest whole digit when released', async () => {
      await dragBy(2.4);
      await release();

      expect(head()).toBeCloseTo(NEWEST - 2);
    });

    it('drags back towards the newest digit', async () => {
      await dragBy(5);
      await release();
      await dragBy(-3);
      await release();

      expect(head()).toBeCloseTo(NEWEST - 2);
    });

    it('stops at the first digit', async () => {
      await dragBy(1000);

      expect(head()).toBeCloseTo(0);
    });

    it('stops at the newest digit', async () => {
      await dragBy(-1000);

      expect(head()).toBeCloseTo(NEWEST);
    });

    it('ignores secondary pointers, other buttons and other pointers moving', async () => {
      await dragBy(3, { isPrimary: false });
      await dragBy(3, { button: 2 });
      pointer('pointerdown', 200);
      pointer('pointermove', 200 + 3 * CELL, { pointerId: 2 });
      pointer('pointerup', 0, { pointerId: 2 });
      await run(1000);

      expect(head()).toBeCloseTo(NEWEST);
    });

    it('ignores drags while nothing is typed', async () => {
      await show('');
      await dragBy(3);
      await release();

      expect(setPointerCapture).not.toHaveBeenCalled();
    });

    it('slides back to the newest digit, quickly but smoothly, when a digit is typed', async () => {
      await dragBy(10);
      await release();

      fixture.componentRef.setInput('digits', DIGITS + '0');
      await run(30);
      expect(head()).toBeGreaterThan(NEWEST - 10);
      expect(head()).toBeLessThan(NEWEST + 1);

      await run(1000);
      expect(head()).toBeCloseTo(NEWEST + 1);
    });

    it('scrolls with a wheel or trackpad, then settles on a whole digit', async () => {
      const event = wheel({ deltaX: -2.4 * CELL });
      await run(1000);

      expect(event.defaultPrevented).toBe(true);
      expect(head()).toBeCloseTo(NEWEST - 2);
    });

    it('scrolls with a vertical wheel too, and by lines', async () => {
      wheel({ deltaY: -3, deltaMode: WheelEvent.DOM_DELTA_LINE });
      wheel({ deltaY: 1, deltaMode: WheelEvent.DOM_DELTA_LINE });
      await run(1000);

      expect(head()).toBeCloseTo(NEWEST - 2);
    });

    it('drops a pending wheel settle when destroyed', () => {
      wheel({ deltaX: -2.4 * CELL });
      const clear = vi.spyOn(globalThis, 'clearTimeout');

      fixture.destroy();

      expect(clear).toHaveBeenCalled();
    });

    it('ignores the wheel while nothing is typed', async () => {
      await show('');

      expect(wheel({ deltaX: -100 }).defaultPrevented).toBe(false);
    });

    it('moves by one digit with the arrow keys and to either end with Home and End', async () => {
      key({ key: 'ArrowLeft' });
      key({ key: 'ArrowLeft' });
      key({ key: 'ArrowRight' });
      await run(1000);
      expect(head()).toBeCloseTo(NEWEST - 1);

      expect(key({ key: 'Home' }).defaultPrevented).toBe(true);
      await run(1000);
      expect(head()).toBeCloseTo(0);

      key({ key: 'End' });
      await run(1000);
      expect(head()).toBeCloseTo(NEWEST);
    });

    it('ignores other keys, shortcuts, and keys while nothing is typed', async () => {
      expect(key({ key: 'ArrowLeft', ctrlKey: true }).defaultPrevented).toBe(false);
      expect(key({ key: 'ArrowUp' }).defaultPrevented).toBe(false);
      await run(1000);
      expect(head()).toBeCloseTo(NEWEST);

      await show('');
      expect(key({ key: 'Home' }).defaultPrevented).toBe(false);
    });
  });
});
