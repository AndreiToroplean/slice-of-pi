import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { unlockTo } from '../../../testing/checkpoints';
import { Checkpoint } from '../../player-data/checkpoint';
import { SHORTEST_PRESS } from '../../ui/candy';
import { NUDGE, StartFrom, SWIPE_WAIT } from './start-from';

describe('StartFrom', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  interface Parts {
    readonly link: HTMLAnchorElement;
    readonly place: HTMLElement | null;
    readonly swipe: HTMLElement | null;
    readonly stable: () => Promise<void>;
  }

  /**
   * A button starting Free Play, the place 60 pixels wide, once the checkpoints up to `unlocked` are, starting from its
   * place if `from`, told to nudge it if `nudge`.
   */
  async function setUp(unlocked = 100, from = false, nudge = false): Promise<Parts> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    if (unlocked > 0) {
      await unlockTo(unlocked);
    }
    await TestBed.inject(Checkpoint).loaded;
    if (from) {
      await TestBed.inject(Checkpoint).switchTo('free', true);
    }
    const fixture = TestBed.createComponent(StartFrom);
    fixture.componentRef.setInput('mode', 'free');
    fixture.componentRef.setInput('path', '/play');
    fixture.componentRef.setInput('name', 'Free Play');
    fixture.componentRef.setInput('nudge', nudge);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const swipe = host.querySelector<HTMLElement>('.swipe');
    if (swipe !== null) {
      Object.defineProperty(swipe, 'clientWidth', { value: 300 });
      Object.defineProperty(swipe, 'scrollWidth', { value: 360 });
    }
    return {
      link: host.querySelector('a') ?? document.createElement('a'),
      place: host.querySelector('.place'),
      swipe,
      stable: () => fixture.whenStable(),
    };
  }

  /** Swipes it as far as `left`, and lets go. */
  async function swipeTo({ swipe, stable }: Parts, left: number): Promise<void> {
    if (swipe !== null) {
      swipe.scrollLeft = left;
      swipe.dispatchEvent(new Event('scroll'));
      swipe.dispatchEvent(new Event('scrollend'));
    }
    await stable();
  }

  it('starts from the start of π, with nothing to swipe, before a checkpoint is unlocked', async () => {
    const { link, swipe } = await setUp(0);

    expect(swipe).toBeNull();
    expect(link.getAttribute('href')).toBe('/play');
  });

  it('starts from the start of π until swiped to start from its place, which it keeps', async () => {
    const parts = await setUp();
    await TestBed.inject(Checkpoint).pick('free', 30);
    await parts.stable();
    expect(parts.link.getAttribute('href')).toBe('/play');
    expect(parts.place?.querySelector('.picker')?.hasAttribute('inert')).toBe(true);

    // Not far enough: back where it was.
    await swipeTo(parts, 20);
    expect(TestBed.inject(Checkpoint).startsFrom('free')).toBe(false);

    await swipeTo(parts, 60);
    expect(TestBed.inject(Checkpoint).startsFrom('free')).toBe(true);
    expect(parts.link.getAttribute('href')).toBe('/play?from=30');
    expect(parts.link.textContent.trim()).toBe('Free Play from');
    expect(parts.place?.querySelector('.picker')?.hasAttribute('inert')).toBe(false);

    await swipeTo(parts, 0);
    expect(TestBed.inject(Checkpoint).startsFrom('free')).toBe(false);
    expect(parts.link.getAttribute('href')).toBe('/play');
  });

  it('unfolds its place from its arrow, and folds it back on a press of its spinner, but for a drag', async () => {
    const parts = await setUp();
    const arrow = parts.swipe?.querySelector<HTMLButtonElement>('button[title="Free Play From"]');
    const spinner = parts.place?.querySelector<HTMLElement>('[role="spinbutton"]');

    arrow?.click();
    expect(parts.swipe?.scrollLeft).toBe(360);
    await swipeTo(parts, 60);
    expect(TestBed.inject(Checkpoint).startsFrom('free')).toBe(true);
    expect(arrow?.getAttribute('aria-expanded')).toBe('true');

    // Dragged, it picks a place.
    if (spinner !== null && spinner !== undefined) {
      spinner.setPointerCapture = (): void => undefined;
      spinner.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, clientY: 100 }),
      );
      spinner.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, isPrimary: true, clientY: 40 }),
      );
      spinner.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, isPrimary: true, clientY: 40 }),
      );
    }
    const unfolded = parts.swipe?.scrollLeft;
    spinner?.click();
    expect(parts.swipe?.scrollLeft).toBe(unfolded);
    expect(TestBed.inject(Checkpoint).place('free')).toBe(20);

    spinner?.click();
    expect(parts.swipe?.scrollLeft).toBe(0);
    await swipeTo(parts, 0);
    expect(TestBed.inject(Checkpoint).startsFrom('free')).toBe(false);
  });

  it('turns its arrow as far as its place has come in', async () => {
    const parts = await setUp();

    await swipeTo(parts, 30);

    expect(parts.swipe?.style.getPropertyValue('--unfolded')).toBe('0.5');
  });

  it('shows its place in as far as it is swiped', async () => {
    const parts = await setUp();

    if (parts.swipe !== null) {
      parts.swipe.scrollLeft = 25;
      parts.swipe.dispatchEvent(new Event('scroll'));
    }
    await parts.stable();

    expect(parts.swipe?.style.getPropertyValue('--shown')).toBe('25px');
  });

  it('starts from its place where it was swiped to before', async () => {
    const { link, place } = await setUp(100, true);

    expect(place?.querySelector('.picker')?.hasAttribute('inert')).toBe(false);
    expect(link.getAttribute('href')).toBe('/play?from=0');
  });

  it('nudges its place in and back, told to, without starting from it', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const parts = await setUp(100, false, true);

    expect(parts.swipe?.scrollLeft).toBe(NUDGE);
    expect(parts.swipe?.classList).toContain('nudging');
    await swipeTo(parts, NUDGE);
    expect(parts.swipe?.scrollLeft).toBe(0);
    await swipeTo(parts, 0);
    expect(parts.swipe?.classList).not.toContain('nudging');
    expect(TestBed.inject(Checkpoint).startsFrom('free')).toBe(false);
    vi.unstubAllGlobals();
  });

  it('presses all of it as what it starts is pressed, and none of it as its place is', async () => {
    const { link, place } = await setUp();
    const arrow = place?.querySelector<HTMLElement>('button') ?? null;
    vi.useFakeTimers();

    arrow?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(SWIPE_WAIT);
    TestBed.tick();
    expect(place?.classList).not.toContain('pressed');
    document.dispatchEvent(new PointerEvent('pointerup'));

    // Once it's clear it's no swipe.
    link.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    TestBed.tick();
    expect(link.classList).not.toContain('pressed');
    vi.advanceTimersByTime(SWIPE_WAIT);
    TestBed.tick();
    expect(link.classList).toContain('pressed');
    expect(place?.classList).toContain('pressed');
  });

  it('lets go of both parts at once', async () => {
    const { link, place } = await setUp();
    vi.useFakeTimers();

    link.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointerup'));
    TestBed.tick();
    // What it starts doesn't let go as the browser does, on its own.
    expect(link.classList).toContain('controlled');
    expect(link.classList).toContain('pressed');
    vi.advanceTimersByTime(SHORTEST_PRESS);
    TestBed.tick();
    expect(link.classList).not.toContain('pressed');
    expect(place?.classList).not.toContain('pressed');
  });
});
