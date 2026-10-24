import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { COPIED_MS, CopyValues, WRITE_CLIPBOARD } from './copy-values';
import { tweaksBackup } from '../../developer-mode/tweaks';
import { RUN_CLOCK } from '../../player-data/run-recorder';

@Component({
  imports: [CopyValues],
  template: `<app-copy-values [values]="{ seasonTurn: 3 }" />`,
})
class Host {}

describe('CopyValues', () => {
  const writeClipboard = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    writeClipboard.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: WRITE_CLIPBOARD, useValue: writeClipboard },
        { provide: RUN_CLOCK, useValue: { now: () => 0, epoch: () => 1000, newId: () => 'id' } },
      ],
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

  it('copies the values as a backup holding them, and says so for a moment', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    writeClipboard.mockResolvedValue();
    const { button, stable } = await setUp();
    expect(button?.textContent.trim()).toBe('Copy Hyperparameter Values');

    button?.click();
    await stable();

    expect(writeClipboard).toHaveBeenCalledWith(tweaksBackup({ seasonTurn: 3 }, 1000));
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
