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
  // The game starts again once it no longer shows itself over.
  await expect(page.locator('.game-over')).toHaveCount(0);
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
  // The game carries on once it no longer shows itself over.
  await expect(page.locator('.game-over')).toHaveCount(0);

  await page.keyboard.press('Backspace');
  await page.keyboard.press('1');
  await expect(page.locator('app-slots .slot').first()).toHaveText('1');
  await expect(page.locator('app-slots .wrong')).toHaveCount(0);
});

test('continues a lost challenge in Discovery, from where the group holding the mistake starts', async ({
  page,
}) => {
  await page.goto('/challenge');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  for (const key of '1415927') {
    await page.keyboard.press(key);
  }
  const over = page.getByRole('dialog', { name: 'Game Over' });
  await over.getByRole('button', { name: 'Continue in Discovery' }).click();

  await expect(over).toBeHidden();
  // Discovery, on the same screen: the game shows the group the mistake was in, the mistake gone.
  await expect(page.locator('app-play')).toHaveAttribute('data-turn', 'game');
  await expect(page.locator('app-typed-digits .word').first()).toHaveText('14159');
  await expect(page.locator('app-slots .wrong')).toHaveCount(0);
  await expect(page).toHaveURL('/challenge');
});
