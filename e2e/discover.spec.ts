import { expect, test } from '@playwright/test';

test('shows a group in Discover, then takes the player’s retyping, the next round shown with a tap, hurried held', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Discover' }).click();
  await expect(page).toHaveURL('/discover');
  const faint = page.locator('app-typed-digits .tile.faint');
  const turnKey = page.locator('app-keypad button[data-key="backspace"]');
  const shade = page.locator('.turn-shade');

  // The game shows the first group; the player takes their turn as they type.
  await expect(turnKey).toHaveAccessibleName('Fast forward');
  await expect(faint).toHaveCount(5);
  for (const key of '14159') {
    await page.keyboard.press(key);
  }
  await expect(faint).toHaveCount(0);
  await expect(shade).toHaveAttribute('data-turn', 'player');

  // A tap of the turn key, with the space bar, switches turns at once; held, it fast forwards the next round.
  await expect(turnKey).toHaveAccessibleName('Switch turns');
  await page.keyboard.press(' ');
  await expect(shade).toHaveAttribute('data-turn', 'game');
  await page.keyboard.down(' ');
  await expect(faint).toHaveCount(10, { timeout: 5_000 });
  await page.keyboard.up(' ');
  await expect(turnKey).toHaveAccessibleName('Switch turns');
});
