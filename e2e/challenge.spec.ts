import { expect, test } from '@playwright/test';

test('loses a challenge on its first mistake, the game over dialog staying open until the player plays again', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Challenge' }).click();
  await expect(page).toHaveURL('/challenge');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await page.keyboard.press('1');
  await page.keyboard.press('0');
  const over = page.getByRole('dialog', { name: 'Game Over' });
  await expect(over).toBeVisible();
  const playAgain = over.getByRole('button', { name: 'Play Again' });
  await expect(playAgain).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(over).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(over).toBeHidden();
  await page.keyboard.press('1');
  await expect(page.locator('app-slots .slot').first()).toHaveText('1');
});

test('continues a lost challenge in free play, deleting the mistake with backspace', async ({
  page,
}) => {
  await page.goto('/challenge');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('0');
  const over = page.getByRole('dialog', { name: 'Game Over' });
  await over.getByRole('button', { name: 'Continue in Free Play' }).click();
  await expect(over).toBeHidden();

  await page.keyboard.press('Backspace');
  await page.keyboard.press('1');
  await expect(page.locator('app-slots .slot').first()).toHaveText('1');
  await expect(page.locator('app-slots .wrong')).toHaveCount(0);
});
