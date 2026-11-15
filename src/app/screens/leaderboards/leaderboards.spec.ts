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
        shown.querySelectorAll('#board-perfect li:not(.empty)').length === Math.min(runs.length, 3),
      { runs },
    );
    return host;
  }

  /** The records on a board's podium. */
  const podium = (host: HTMLElement, board: string): string[] =>
    Array.from(host.querySelectorAll(`#board-${board} app-podium li:not(.empty)`), (li) =>
      Array.from(li.children, (part) => part.textContent.trim())
        .filter((text) => text !== '')
        .join(' '),
    );

  it('ranks the farthest perfect runs on a podium, the best first, with their dates', async () => {
    const host = await open([run('a', 3, 12), run('b', 12, 41), run('c', 1, 7), run('d', 9, 30)]);

    expect(podium(host, 'perfect')).toEqual(['1 41 12 Nov', '2 30 9 Nov', '3 12 3 Nov']);
  });

  it('shows how far the best is from the next goal', async () => {
    const host = await open([run('a', 3, 41)]);

    const goal = host.querySelector('#board-perfect app-next-goal')?.textContent;
    expect(goal).toContain('Next: 50');
    expect(goal).toContain('9 to go');
  });

  it('shows the fastest perfect runs on their own tab', async () => {
    const host = await open([run('a', 3, 30)]);
    host.querySelector<HTMLElement>('#board-tab-fastest')?.click();
    await vi.waitFor(() => {
      expect(host.querySelector('#board-fastest')?.hasAttribute('inert')).toBe(false);
    });

    expect(host.querySelector('#board-fastest li')?.textContent).toContain('2.4 s');
    expect(host.querySelector('#board-perfect')?.hasAttribute('inert')).toBe(true);
  });

  it('ranks the runs proving the most digits known, with how far they got and their mistakes', async () => {
    // π's first decimals: 1, 4, 1, 5.
    const known = typeKeys(['1', '4', '0', 'backspace', '1', '5', '9'], newTouchLog('k', 0));
    const host = await open([known]);
    host.querySelector<HTMLElement>('#board-tab-known')?.click();
    await vi.waitFor(() => {
      expect(host.querySelector('#board-known')?.hasAttribute('inert')).toBe(false);
    });

    expect(podium(host, 'known')).toEqual(['1 4 reached 5, 1 mistake 1 Jan']);
  });
});
