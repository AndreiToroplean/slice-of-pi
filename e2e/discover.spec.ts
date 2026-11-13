import { expect, test } from '@playwright/test';

test('shows a group in Discover, then takes the player’s retyping, the next round shown at once and hurried', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Discover' }).click();
  await expect(page).toHaveURL('/discover');
  const faint = page.locator('app-typed-digits .tile.faint');
  const fastForward = page.getByRole('button', { name: 'Fast forward' });

  // The game shows the first group; the player takes their turn as they type.
  await expect(faint).toHaveCount(5);
  for (const key of '14159') {
    await page.keyboard.press(key);
  }
  await expect(faint).toHaveCount(0);
  await expect(fastForward).not.toHaveClass(/lit/);

  // The next round, one more group, shown at once and hurried as the space bar is held.
  await page.keyboard.down(' ');
  await expect(fastForward).toHaveClass(/lit/);
  await expect(faint).toHaveCount(10, { timeout: 5_000 });
  await page.keyboard.up(' ');
  await expect(fastForward).toHaveAttribute('aria-pressed', 'false');
});
