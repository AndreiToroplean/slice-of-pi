import { TestBed } from '@angular/core/testing';
import { PALETTE } from '../../game/layers/place-colors';
import { Fastest, splitTime } from './fastest';
import { RunRecord } from './records';

describe('Fastest', () => {
  const record = (id: string, splits: number[]): RunRecord => ({
    id,
    startedAt: 0,
    perfect: 0,
    splits,
    known: { digits: 0, reached: 0, mistakes: 0 },
  });

  async function rows(records: RunRecord[]): Promise<string[]> {
    const fixture = TestBed.createComponent(Fastest);
    fixture.componentRef.setInput('records', records);
    await fixture.whenStable();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li'), (li) =>
      Array.from(li.children, (part) => part.textContent.trim())
        .filter((text) => text !== '')
        .join(' '),
    );
  }

  it('ranks the fastest time to each split place reached, then locks the next', async () => {
    expect(
      await rows([record('a', [9_000, 20_000]), record('b', [8_000]), record('c', [9_500])]),
    ).toEqual(['25 8.0 s 9.0 s · 9.5 s', '50 20.0 s', '100 Not reached yet']);
  });

  it('colors the split places with the palette, in order', async () => {
    const fixture = TestBed.createComponent(Fastest);
    fixture.componentRef.setInput('records', [record('a', [1, 2, 3])]);
    await fixture.whenStable();
    // As the browser writes a color, to compare them.
    const written = (color: string): string => {
      const probe = document.createElement('span');
      probe.style.background = color;
      return probe.style.background;
    };
    const tiles = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      'li:not(.locked) .tile',
    );

    expect(Array.from(tiles, (tile) => tile.style.background)).toEqual(
      PALETTE.slice(0, 3).map(written),
    );
  });

  it('locks the first split place before any perfect run reaches it', async () => {
    expect(await rows([record('a', [])])).toEqual(['25 Not reached yet']);
  });

  it('says times in seconds to a tenth, with minutes past one', () => {
    expect([7_940, 59_960, 84_100, 600_000].map(splitTime)).toEqual([
      '7.9 s',
      '1:00.0',
      '1:24.1',
      '10:00.0',
    ]);
  });
});
