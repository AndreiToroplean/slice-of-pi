import { TestBed } from '@angular/core/testing';
import { seasonAt } from '../seasons/seasons';
import { SeasonHeader } from './season-header';

describe('SeasonHeader', () => {
  async function render(places: number): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(SeasonHeader);
    fixture.componentRef.setInput('view', seasonAt(places));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the season, the year and the place in the year', async () => {
    const host = await render(0);

    expect(host.querySelector('.name')?.textContent.trim()).toBe('Spring');
    expect(host.querySelector('.place')?.textContent.trim()).toBe('Year 1 · digit 0 of 100');
  });

  it.each([
    [30, 'Summer', 'Year 1 · digit 30 of 100'],
    [60, 'Autumn', 'Year 1 · digit 60 of 100'],
    [99, 'Winter', 'Year 1 · digit 99 of 100'],
    [112, 'Spring', 'Year 2 · digit 12 of 100'],
  ])('after %i places shows %s, %s', async (places, name, place) => {
    const host = await render(places);

    expect(host.querySelector('.name')?.textContent.trim()).toBe(name);
    expect(host.querySelector('.place')?.textContent.trim()).toBe(place);
  });

  it('shows an icon for each season, hidden from assistive technology', async () => {
    const icons = new Set<string>();
    for (const places of [0, 25, 50, 75]) {
      const icon = (await render(places)).querySelector('.name svg');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
      icons.add(icon?.innerHTML ?? '');
    }
    expect(icons.size).toBe(4);
  });

  it('fills the year bar up to the place in the year', async () => {
    const host = await render(60);

    const fills = Array.from(host.querySelectorAll<HTMLElement>('.year i'), (i) => i.style.width);
    expect(fills).toEqual(['100%', '100%', '40%', '0%']);
    expect(host.querySelector('.year')?.getAttribute('aria-hidden')).toBe('true');
  });
});
