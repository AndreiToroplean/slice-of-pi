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

  beforeEach(() => {
    FakeResizeObserver.install();
    vi.useFakeTimers();
    fixture = TestBed.createComponent(DigitTape);
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
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
});
