import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Digit } from '../digit';
import { DigitTape, TAPE_CAPACITY } from './digit-tape';
import { appendDigit, EMPTY_TAPE, Tape } from './tape';

describe('DigitTape', () => {
  let fixture: ComponentFixture<DigitTape>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DigitTape);
  });

  async function show(digits: readonly Digit[], capacity = TAPE_CAPACITY): Promise<HTMLElement> {
    let tape: Tape = EMPTY_TAPE;
    for (const digit of digits) {
      tape = appendDigit(tape, digit, capacity);
    }
    fixture.componentRef.setInput('tape', tape);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function digitElements(host: HTMLElement): HTMLElement[] {
    return Array.from(host.querySelectorAll<HTMLElement>('.digit'));
  }

  it('shows nothing before any digit is typed', async () => {
    const host = await show([]);

    expect(digitElements(host)).toEqual([]);
    expect(host.querySelector('.visually-hidden')?.textContent).toBe('No digits typed yet.');
  });

  it('shows the typed digits in order', async () => {
    const host = await show(['3', '1', '4']);

    expect(digitElements(host).map((element) => element.textContent)).toEqual(['3', '1', '4']);
  });

  it('offsets each digit from the newest one, which sits at offset 0', async () => {
    const host = await show(['3', '1', '4']);

    expect(
      digitElements(host).map((element) => element.style.getPropertyValue('--offset')),
    ).toEqual(['-2', '-1', '0']);
  });

  it('keeps the same element for a digit as new digits arrive, so it can slide', async () => {
    const host = await show(['3', '1']);
    const first = digitElements(host)[0];

    await show(['3', '1', '4']);

    expect(digitElements(host)[0]).toBe(first);
    expect(first?.style.getPropertyValue('--offset')).toBe('-2');
  });

  it('renders at most the given number of recent digits', async () => {
    const host = await show(['3', '1', '4', '1', '5'], 2);

    expect(digitElements(host).map((element) => element.textContent)).toEqual(['1', '5']);
  });

  it('exposes its capacity to the styles', async () => {
    const host = await show([]);

    expect(host.style.getPropertyValue('--capacity')).toBe(String(TAPE_CAPACITY));
  });

  it('hides the visual tape from assistive technology and summarizes it instead', async () => {
    const host = await show(['3', '1', '4']);

    expect(host.querySelector('.tape')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('.visually-hidden')?.textContent).toBe(
      '3 digits typed, the last one is 4.',
    );
  });
});
