import { expect, test } from '@playwright/test';

test('closes a dialog on a click outside it, as on Escape', async ({ page }) => {
  await page.goto('/play');
  await page.getByRole('button', { name: 'Pause' }).click();
  const paused = page.getByRole('dialog', { name: 'Paused' });
  await expect(paused).toBeVisible();

  await page.mouse.click(5, 5);

  await expect(paused).toBeHidden();
});
