import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { COPIED_MS, CopyValues, WRITE_CLIPBOARD } from './copy-values';

@Component({ imports: [CopyValues], template: `<app-copy-values text="Some values" />` })
class Host {}

describe('CopyValues', () => {
  const writeClipboard = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    writeClipboard.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: WRITE_CLIPBOARD, useValue: writeClipboard }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function setUp(): Promise<{
    button: HTMLButtonElement | null;
    stable: () => Promise<void>;
  }> {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return {
      button: (fixture.nativeElement as HTMLElement).querySelector('button'),
      stable: () => fixture.whenStable(),
    };
  }

  it('copies the values, and says so for a moment', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    writeClipboard.mockResolvedValue();
    const { button, stable } = await setUp();
    expect(button?.textContent.trim()).toBe('Copy Hyperparameter Values');

    button?.click();
    await stable();

    expect(writeClipboard).toHaveBeenCalledWith('Some values');
    expect(button?.textContent.trim()).toBe('Copied');
    vi.advanceTimersByTime(COPIED_MS);
    await stable();
    expect(button?.textContent.trim()).toBe('Copy Hyperparameter Values');
  });

  it("says when the clipboard can't be written", async () => {
    writeClipboard.mockRejectedValue(new Error('denied'));
    const { button, stable } = await setUp();

    button?.click();
    await stable();

    expect(button?.textContent.trim()).toBe("Couldn't Copy");
  });
});
