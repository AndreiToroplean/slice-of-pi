import { TestBed } from '@angular/core/testing';
import { placeColors } from '../place-colors/place-colors';
import { Slots } from './slots';

describe('Slots', () => {
  async function render(digits: string, hint = 5): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Slots);
    fixture.componentRef.setInput('digits', digits);
    fixture.componentRef.setInput('colors', placeColors(digits));
    fixture.componentRef.setInput('hint', hint);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function slots(host: HTMLElement): HTMLElement[] {
    return Array.from(host.querySelectorAll<HTMLElement>('.slot'));
  }

  it('shows as many empty slots as the hint, the first one next', async () => {
    const host = await render('');

    expect(slots(host).map((slot) => slot.className)).toEqual([
      'slot next',
      'slot',
      'slot',
      'slot',
      'slot',
    ]);
    expect(slots(host).every((slot) => slot.textContent === '')).toBe(true);
  });

  it('fills the slots with the digits typed, the following one next', async () => {
    const host = await render('141');

    expect(slots(host).map((slot) => slot.textContent)).toEqual(['1', '4', '1', '', '']);
    expect(slots(host).map((slot) => slot.className)).toEqual([
      'slot filled',
      'slot filled',
      'slot filled',
      'slot next',
      'slot',
    ]);
  });

  it('shows each filled slot in its color, and the empty ones in none', async () => {
    const host = await render('141');

    expect(slots(host).map((slot) => slot.style.getPropertyValue('--place-color'))).toEqual([
      ...placeColors('141'),
      '',
      '',
    ]);
  });

  it('adds a filled slot per digit typed past the hint, with no next slot', async () => {
    const host = await render('1415926');

    expect(slots(host).map((slot) => slot.textContent)).toEqual('1415926'.split(''));
    expect(host.querySelector('.next')).toBeNull();
  });

  it('lays out one row up to 10 slots, then wraps onto new rows', async () => {
    expect((await render('')).style.getPropertyValue('--columns')).toBe('5');
    expect((await render('14159265')).style.getPropertyValue('--columns')).toBe('8');

    const host = await render('141592653589');

    expect(slots(host)).toHaveLength(12);
    expect(host.style.getPropertyValue('--columns')).toBe('10');
  });

  it('switches to smaller slots past 6', async () => {
    expect((await render('141592')).classList).not.toContain('dense');
    expect((await render('1415926')).classList).toContain('dense');
  });

  it('follows the hint', async () => {
    expect(slots(await render('', 3))).toHaveLength(3);
  });

  it('shows no text besides the digits, and is hidden from assistive technology', async () => {
    const host = await render('14');

    expect(host.textContent.replace(/\s/g, '')).toBe('14');
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });
});
