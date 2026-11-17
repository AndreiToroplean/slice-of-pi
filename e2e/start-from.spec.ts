import { expect, test } from './fixtures';

test('swipes a game mode to start from a checkpoint, or from its arrow, kept for the next visits, and back', async ({
  page,
}) => {
  // A challenge reaching place 10 unlocks its checkpoint.
  await page.goto('/challenge');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  for (const digit of '14159265350') {
    await page.keyboard.press(digit);
  }
  await expect(page.getByRole('dialog', { name: 'Game Over' })).toBeVisible();
  await page.goto('/');
  const freePlay = page.locator('app-start-from.unlocked').filter({ hasText: 'Free Play' });
  const link = freePlay.getByRole('link');
  await expect(link).toHaveAttribute('href', '/play');

  // Swiped left, as a wheel scrolls it across.
  await link.hover();
  await page.mouse.wheel(200, 0);
  await expect(link).toHaveAttribute('href', '/play?from=0');
  await expect(page.getByRole('spinbutton', { name: 'Free Play from' })).toBeVisible();

  await page.reload();
  await expect(link).toHaveAttribute('href', '/play?from=0');
  await expect(page.getByRole('link', { name: 'Challenge', exact: true })).toHaveAttribute(
    'href',
    '/challenge',
  );

  // Or from its arrow.
  await page.getByRole('button', { name: 'Challenge From' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Challenge from' })).toBeVisible();

  // Swiped right, on what it starts.
  await link.hover();
  await page.mouse.wheel(-200, 0);
  await expect(link).toHaveAttribute('href', '/play');
});
