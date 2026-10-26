import { Page } from '@playwright/test';

/**
 * Types the digits as a player would, evenly, so that a group breaks only once they're all typed, however long the
 * test takes in between: a group with no runs before it ends at a pause clearly longer than the run's own.
 */
export async function type(page: Page, digits: string): Promise<void> {
  for (const digit of digits) {
    await page.keyboard.press(digit);
    await page.waitForTimeout(120);
  }
}
