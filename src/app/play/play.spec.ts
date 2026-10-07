import { TestBed } from '@angular/core/testing';
import { FakeResizeObserver } from '../../testing/fake-resize-observer';
import { Play } from './play';

describe('Play', () => {
  beforeEach(() => {
    FakeResizeObserver.install();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: vi.fn(), configurable: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    vi.unstubAllGlobals();
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

  it('has a heading', async () => {
    const { host } = await setUp();

    expect(host.querySelector('h1')?.textContent).toBe('Slice of π');
  });

  it('puts the digits typed on the keypad on the tape', async () => {
    const { host, type } = await setUp();

    for (const digit of '31415') {
      await type(digit);
    }

    expect(host.querySelector('app-digit-tape .visually-hidden')?.textContent).toBe(
      '5 digits typed, the last one is 5.',
    );
  });
});
