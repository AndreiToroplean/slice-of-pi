import { expect, test } from '@playwright/test';

test('pauses the game on Back, and resumes it, keeping the history, so that ending it leads to the main menu, and Back out', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Play' }).click();
  await expect(page).toHaveURL('/play');
  const paused = page.getByRole('dialog', { name: 'Paused' });

  await page.goBack();
  await expect(paused).toBeVisible();
  await expect(page).toHaveURL('/play');
  await page.goBack();
  await expect(paused).toBeHidden();
  await expect(page).toHaveURL('/play');

  await page.goBack();
  await paused.getByRole('button', { name: 'End Game' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'Play' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('about:blank');
});
