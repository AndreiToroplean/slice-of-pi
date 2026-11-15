import { newTouchLog, TouchLog } from '../../player-data/touch-log';
import { openPage } from '../../../testing/player-data-pages';
import { decimals, typeKeys } from '../../../testing/touch-logs';
import { Leaderboards } from './leaderboards';

describe('Leaderboards', () => {
  /** A run on this day of November 2026, typing these many decimals right, then a mistake. */
  const run = (id: string, day: number, right: number): TouchLog =>
    typeKeys([...decimals(right), '0'], newTouchLog(id, new Date(2026, 10, day).getTime()));

  async function open(runs: readonly TouchLog[]): Promise<HTMLElement> {
    const { host } = await openPage(
      Leaderboards,
      (shown) =>
        shown.querySelectorAll('app-podium li:not(.empty)').length === Math.min(runs.length, 3),
      { runs },
    );
    return host;
  }

  const podium = (host: HTMLElement): string[] =>
    Array.from(host.querySelectorAll('app-podium li:not(.empty)'), (li) =>
      Array.from(li.children, (part) => part.textContent.trim())
        .filter((text) => text !== '')
        .join(' '),
    );

  it('ranks the farthest perfect runs on a podium, the best first, with their dates', async () => {
    const host = await open([run('a', 3, 12), run('b', 12, 41), run('c', 1, 7), run('d', 9, 30)]);

    expect(podium(host)).toEqual(['1 41 12 Nov', '2 30 9 Nov', '3 12 3 Nov']);
  });

  it('shows how far the best is from the next goal', async () => {
    const host = await open([run('a', 3, 41)]);

    expect(host.querySelector('app-next-goal')?.textContent).toContain('Next: 50');
    expect(host.querySelector('app-next-goal')?.textContent).toContain('9 to go');
  });

  it('shows the fastest perfect runs on their own tab', async () => {
    const host = await open([run('a', 3, 30)]);
    host.querySelector<HTMLElement>('[role="tab"]:nth-of-type(2)')?.click();
    await vi.waitFor(() => {
      expect(host.querySelector('app-fastest li')?.textContent).toContain('2.4 s');
    });

    expect(host.querySelector('app-podium')).toBeNull();
  });
});
