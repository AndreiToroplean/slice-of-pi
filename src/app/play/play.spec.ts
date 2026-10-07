import { TestBed } from '@angular/core/testing';
import { FakeResizeObserver } from '../../testing/fake-resize-observer';
import { Play } from './play';

describe('Play', () => {
  beforeEach(() => {
    FakeResizeObserver.install();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function setUp(): Promise<{ host: HTMLElement; type: (key: string) => Promise<void> }> {
    const fixture = TestBed.createComponent(Play);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const type = async (key: string): Promise<void> => {
      host.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`)?.click();
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

  it('deletes the last digit with backspace', async () => {
    const { host, type } = await setUp();

    for (const key of ['3', '1', '4', 'backspace', 'backspace', '5']) {
      await type(key);
    }

    expect(host.querySelector('app-digit-tape .visually-hidden')?.textContent).toBe(
      '2 digits typed, the last one is 5.',
    );
  });

  it('does nothing on backspace when nothing is typed', async () => {
    const { host, type } = await setUp();

    await type('backspace');

    expect(host.querySelector('app-digit-tape .visually-hidden')?.textContent).toBe(
      'No digits typed yet.',
    );
  });
});
