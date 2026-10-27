import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Carousel } from './carousel';

@Component({
  imports: [Carousel],
  template: `
    <app-carousel label="Steps">
      <section>One</section>
      <section>Two</section>
      <section>Three</section>
    </app-carousel>
  `,
})
class Host {}

@Component({
  imports: [Carousel],
  template: `
    <app-carousel label="Steps">
      <section>One</section>
      @if (more()) {
        <section>Two</section>
      }
    </app-carousel>
  `,
})
class SingleHost {
  readonly more = signal(false);
}

describe('Carousel', () => {
  /** A carousel of three views, 300 pixels wide, showing the view given, and where it was told to scroll to. */
  async function carousel(shown: number) {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const track = host.querySelector<HTMLElement>('[role="group"]');
    if (track === null) {
      throw new Error('No track');
    }
    Object.defineProperty(track, 'clientWidth', { value: 300 });
    Object.defineProperty(track, 'scrollWidth', { value: 900 });
    track.scrollLeft = shown * 300;
    const scrolls: number[] = [];
    track.scrollTo = ((options: ScrollToOptions) => {
      scrolls.push(options.left ?? 0);
    }) as typeof track.scrollTo;
    const press = (label: string) => {
      host.querySelector<HTMLButtonElement>(`button[title="${label}"]`)?.click();
    };
    return { track, scrolls, press };
  }

  it('names its views for screen readers', async () => {
    const { track } = await carousel(0);
    expect(track.getAttribute('aria-label')).toBe('Steps');
  });

  it('shows the next view and the previous one', async () => {
    const { scrolls, press } = await carousel(1);
    press('Next');
    press('Previous');
    expect(scrolls).toEqual([600, 300]);
  });

  it('steps on from the view it scrolls to, while it scrolls there', async () => {
    const { track, scrolls, press } = await carousel(0);
    press('Next');
    track.scrollLeft = 120;
    press('Next');
    track.dispatchEvent(new Event('scrollend'));
    track.scrollLeft = 480;
    press('Previous');
    expect(scrolls).toEqual([300, 600, 300]);
  });

  it('goes around past either end', async () => {
    const last = await carousel(2);
    last.press('Next');
    expect(last.scrolls).toEqual([0]);
    const first = await carousel(0);
    first.press('Previous');
    expect(first.scrolls).toEqual([600]);
  });

  it('steps from the view nearest, while swiped between two', async () => {
    const { track, scrolls, press } = await carousel(0);
    track.scrollLeft = 320;
    press('Next');
    expect(scrolls).toEqual([600]);
  });

  it('shows a single view as if it were not in a carousel, until another comes', async () => {
    const fixture = TestBed.createComponent(SingleHost);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const track = host.querySelector('[role="group"]');

    expect(host.querySelectorAll('button')).toHaveLength(0);
    expect(track?.hasAttribute('tabindex')).toBe(false);

    fixture.componentInstance.more.set(true);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    expect(Array.from(host.querySelectorAll('button'), (button) => button.title)).toEqual([
      'Previous',
      'Next',
    ]);
    expect(track?.getAttribute('tabindex')).toBe('0');
  });
});
