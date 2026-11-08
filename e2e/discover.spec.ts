import { expect, test } from '@playwright/test';

test('shows a group in Discover, then takes the player’s retyping, showing one more group when asked', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Discover' }).click();
  await expect(page).toHaveURL('/discover');
  const faint = page.locator('app-typed-digits .tile.faint');
  const discoverKey = page.getByRole('button', { name: 'Show me' });

  // The game shows the first group, then hands it over: the discover key, held meanwhile, comes back up.
  await expect(faint).toHaveCount(5);
  await expect(discoverKey).not.toHaveClass(/pressed/);
  for (const key of '14159') {
    await page.keyboard.press(key);
  }
  await expect(faint).toHaveCount(0);
  await expect(page.locator('app-typed-digits .word')).toHaveCount(1);

  // The next round, one more group, once asked: ten digits at the game's pace, longer than an assertion waits.
  await discoverKey.click();
  await expect(faint).toHaveCount(10, { timeout: 15_000 });
});
