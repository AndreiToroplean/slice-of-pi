import { expect, test } from '@playwright/test';

test('plays from the keyboard: Enter on the main menu, Escape to pause, up and down through the pause menu', async ({
  page,
}) => {
  await page.goto('/');
  const play = page.getByRole('link', { name: 'Play' });
  await expect(play).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/play');

  const paused = page.getByRole('dialog', { name: 'Paused' });
  await page.keyboard.press('Escape');
  await expect(paused).toBeVisible();
  await expect(paused.getByRole('button', { name: 'Resume' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(paused).toBeHidden();

  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowUp');
  const endGame = paused.getByRole('button', { name: 'End Game' });
  await expect(endGame).toBeFocused();
  await expect(endGame).toHaveCSS('animation-name', /breathe/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/');
  await expect(play).toBeFocused();
});

test('opens a page from the overflow menu, and goes back on Escape', async ({ page }) => {
  await page.goto('/');
  const more = page.getByRole('button', { name: 'More' });
  await expect(page.getByRole('link', { name: 'Play' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(more).toBeFocused();

  await page.keyboard.press('Enter');
  const yourData = page.getByRole('link', { name: 'Your Data' });
  await expect(yourData).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(yourData).toBeHidden();
  await expect(more).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(yourData).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/data');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL('/');
});
