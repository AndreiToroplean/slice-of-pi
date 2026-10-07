import { TestBed } from '@angular/core/testing';
import { TAPE_CAPACITY } from '../digit-tape/digit-tape';
import { Play } from './play';

describe('Play', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: vi.fn(), configurable: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });

  async function setUp(): Promise<{ host: HTMLElement; type: (digit: string) => Promise<void> }> {
    const fixture = TestBed.createComponent(Play);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const type = async (digit: string): Promise<void> => {
      host.querySelector<HTMLButtonElement>(`button[data-digit="${digit}"]`)?.click();
      await fixture.whenStable();
    };
    return { host, type };
  }

  function tapeText(host: HTMLElement): string {
    return Array.from(host.querySelectorAll('.digit'))
      .map((element) => element.textContent)
      .join('');
  }

  it('has a heading', async () => {
    const { host } = await setUp();

    expect(host.querySelector('h1')?.textContent).toBe('Slice of π');
  });

  it('shows the digits typed on the keypad on the tape', async () => {
    const { host, type } = await setUp();

    for (const digit of '31415') {
      await type(digit);
    }

    expect(tapeText(host)).toBe('31415');
  });

  it('keeps only the most recent digits on the tape', async () => {
    const { host, type } = await setUp();

    for (let i = 0; i < TAPE_CAPACITY + 5; i++) {
      await type(String(i % 10));
    }

    expect(host.querySelectorAll('.digit')).toHaveLength(TAPE_CAPACITY);
    expect(host.querySelector('.visually-hidden:not(h1)')?.textContent).toBe(
      `${String(TAPE_CAPACITY + 5)} digits typed, the last one is 8.`,
    );
  });
});
