import { expect, test } from '@playwright/test';

test('closes a menu when its button is pressed again', async ({ page }) => {
  await page.goto('/');
  // Developer mode, which has the tabs of Your Runs and their menu, turned on by tapping the game's icon ten times.
  const icon = page.getByRole('button', { name: 'Slice of Pi' });
  for (let tap = 0; tap < 10; tap++) {
    await icon.click();
  }
  await page.getByRole('link', { name: 'Your Runs' }).click();
  const more = page.locator('.bar').getByRole('button', { name: 'More' });
  const menu = page.locator('.bar .dropdown');

  await more.click();
  await expect(menu).toBeVisible();
  // Under the button, and to its left: it grows from its corner pointing at the button.
  await expect(menu).toHaveCSS('transform-origin', /^[1-9][\d.]*px 0px$/);

  await more.click();
  await expect(menu).toBeHidden();
});
