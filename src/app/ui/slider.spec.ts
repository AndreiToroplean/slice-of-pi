import { TestBed } from '@angular/core/testing';
import { Slider } from './slider';

describe('Slider', () => {
  async function setUp(
    inputs: Record<string, unknown>,
  ): Promise<{ host: HTMLElement; changes: number[]; stable: () => Promise<void> }> {
    const fixture = TestBed.createComponent(Slider);
    const changes: number[] = [];
    fixture.componentInstance.changed.subscribe((value) => {
      changes.push(value);
    });
    for (const [name, value] of Object.entries({ label: 'Depth', min: 0, max: 3, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
    return {
      host: fixture.nativeElement as HTMLElement,
      changes,
      stable: () => fixture.whenStable(),
    };
  }

  function back(host: HTMLElement): HTMLButtonElement | null {
    return host.querySelector<HTMLButtonElement>('button[title="Back to Default"]');
  }

  it('slides its value, and brings it back to its default, only once moved off it', async () => {
    const { host, changes } = await setUp({ value: 0, step: 0.5, defaultValue: 0 });
    expect(back(host)?.disabled).toBe(true);

    const input = host.querySelector<HTMLInputElement>('input');
    if (input !== null) {
      input.value = '1.5';
      input.dispatchEvent(new Event('input'));
    }
    const moved = await setUp({ value: 1.5, step: 0.5, defaultValue: 0 });
    back(moved.host)?.click();

    expect(changes).toEqual([1.5]);
    expect(moved.changes).toEqual([0]);
  });

  it('has no way back without a default', async () => {
    const { host } = await setUp({ value: 1 });

    expect(back(host)).toBeNull();
  });
});
