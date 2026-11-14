import { TestBed } from '@angular/core/testing';
import { SHORTEST_PRESS } from '../../ui/candy';
import { provideRouter } from '@angular/router';
import { StartFrom } from './start-from';

describe('StartFrom', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function setUp(sunk = false): Promise<{ link: HTMLElement; place: HTMLElement }> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(StartFrom);
    fixture.componentRef.setInput('sunk', sunk);
    fixture.componentRef.setInput('mode', 'discovery');
    fixture.componentRef.setInput('path', '/discovery');
    fixture.componentRef.setInput('name', 'Discovery');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    return {
      link: host.querySelector('a') ?? host,
      place: host.querySelector('.place') ?? host,
    };
  }

  it('presses all of it as what it starts is pressed, and none of it as its place is', async () => {
    const { link, place } = await setUp();
    const spinner = place.querySelector<HTMLElement>('[role="spinbutton"]') ?? place;
    spinner.setPointerCapture = (): void => undefined;

    spinner.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }));
    TestBed.tick();
    expect(place.classList).not.toContain('pressed');

    link.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    TestBed.tick();
    expect(link.classList).toContain('pressed');
    expect(place.classList).toContain('pressed');
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
    expect(place.classList).not.toContain('pressed');
  });

  it('shows all of it pressed while sunk', async () => {
    const { link, place } = await setUp(true);

    expect(link.classList).toContain('pressed');
    expect(place.classList).toContain('pressed');
  });
});
