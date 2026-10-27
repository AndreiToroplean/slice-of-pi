import { expect, test } from '@playwright/test';

test('plays from the keyboard: Enter on the main menu, Escape to pause, up and down through the pause menu', async ({
  page,
}) => {
  await page.goto('/');
  const play = page.getByRole('link', { name: 'Play' });
  await expect(play).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  const paused = page.getByRole('dialog', { name: 'Paused' });
  const resume = paused.getByRole('button', { name: 'Resume' });
  await page.keyboard.press('Escape');
  await expect(paused).toBeVisible();
  await expect(resume).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(paused).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(resume).toBeFocused();
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
  // Developer mode, which has the overflow menu, turned on by tapping the game's icon ten times in a row.
  await page.getByRole('button', { name: 'Slice of Pi' }).click({ clickCount: 10 });
  const more = page.getByRole('button', { name: 'Developer Pages' });
  await expect(more).toBeVisible();
  await page.getByRole('link', { name: 'Play' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(more).toBeFocused();

  await page.keyboard.press('Enter');
  // Ready for the keyboard: on its first item, whichever page that is.
  const first = page.locator('.dropdown a').first();
  await expect(first).toBeFocused();
  // Under the button, in the screen's top right corner: its corner pointing at the button is square.
  await expect(page.locator('.dropdown')).toHaveAttribute('data-corner', 'top-right');
  await page.keyboard.press('Escape');
  await expect(first).toBeHidden();
  await expect(more).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(first).toBeFocused();
  // Down to Model Tuning, wherever it is among them.
  const modelTuning = page.getByRole('link', { name: 'Model Tuning' });
  for (
    let step = 0;
    step < 10 && !(await modelTuning.evaluate((link) => link === document.activeElement));
    step++
  ) {
    await page.keyboard.press('ArrowDown');
  }
  await expect(modelTuning).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/developer/model-tuning');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL('/');
});
