import { TestBed } from '@angular/core/testing';
import { seasonAt } from '../../../game/layers/seasons';
import { SeasonHeader } from './season-header';

describe('SeasonHeader', () => {
  async function render(places: number): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(SeasonHeader);
    fixture.componentRef.setInput('view', seasonAt(places));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows digit 0 in spring of year 0 before any digit is typed', async () => {
    const host = await render(0);

    expect(host.querySelector('.count')?.textContent.trim()).toBe('Digit 0');
    expect(host.querySelector('.season')?.textContent.trim()).toBe('Spring · Year 0');
  });

  it.each([
    [30, 'Digit 30', 'Summer · Year 0'],
    [99, 'Digit 99', 'Winter · Year 0'],
    [100, 'Digit 100', 'Spring · Year 1'],
    [195, 'Digit 195', 'Winter · Year 1'],
    [200, 'Digit 200', 'Spring · Year 2'],
    [1234, 'Digit 1234', 'Summer · Year 12'],
  ])('after %i places shows %s, %s', async (places, count, season) => {
    const host = await render(places);

    expect(host.querySelector('.count')?.textContent.trim()).toBe(count);
    expect(host.querySelector('.season')?.textContent.trim()).toBe(season);
  });

  it('shows an icon for each season, hidden from assistive technology', async () => {
    const icons = new Set<string>();
    for (const places of [0, 25, 50, 75]) {
      const icon = (await render(places)).querySelector('.season svg');
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
