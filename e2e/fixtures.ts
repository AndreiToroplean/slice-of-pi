import { test as base } from '@playwright/test';
import { GROUPS_OF_FIVE_FLAG } from '../src/app/game/grouping/break-models/groups-of-five-flag';

export { expect } from '@playwright/test';

/** Which break model a test plays with: groups of 5 alone, or the game's own. */
export interface BreakModelOptions {
  readonly breakModel: 'groups of 5' | 'game';
}

/**
 * Playwright's `test`, every page playing groups of 5 alone, wherever the runs break (see `GROUPS_OF_FIVE`), so that
 * tuning the game's break model leaves the tests as they are. A test about the game's model plays with it instead:
 * `test.use({ breakModel: 'game' })`.
 */
export const test = base.extend<BreakModelOptions>({
  breakModel: ['groups of 5', { option: true }],
  page: async ({ page, breakModel }, use) => {
    if (breakModel === 'groups of 5') {
      await page.addInitScript((flag) => {
        Object.assign(globalThis, { [flag]: true });
      }, GROUPS_OF_FIVE_FLAG);
    }
    await use(page);
  },
});
