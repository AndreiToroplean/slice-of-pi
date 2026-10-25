import { expect, test } from '@playwright/test';

test('closes a menu when its button is pressed again', async ({ page }) => {
  await page.goto('/');
  // Developer mode, which has the tabs of Your Runs and their menu, turned on by tapping the game's icon ten times.
  const icon = page.getByRole('button', { name: 'Slice of Pi' });
  for (let tap = 0; tap < 10; tap++) {
    await icon.click();
  }
  await page.getByRole('link', { name: 'Your Runs' }).click();
  const more = page.locator('.bar').getByRole('button', { name: 'More' });
  const menu = page.locator('.bar .dropdown');

  await more.click();
  await expect(menu).toBeVisible();
  // Under the button, and to its left: it grows from its corner pointing at the button.
  await expect(menu).toHaveCSS('transform-origin', /^[1-9][\d.]*px 0px$/);

  await more.click();
  await expect(menu).toBeHidden();
});

test('closes a menu opened from a button elsewhere when that button is pressed again', async ({
  page,
}) => {
  await page.goto('/developer/season-colors');
  const picker = page.getByRole('button', { name: /Blend colors in/ });
  const menu = page.getByRole('group', { name: 'Blend colors in' });

  await picker.click();
  await expect(menu).toBeVisible();
  // Lined up with the button, rather than with a point in it, and clear of it.
  const [button, opened] = [await picker.boundingBox(), await menu.boundingBox()];
  expect(button).not.toBeNull();
  expect(opened).not.toBeNull();
  if (button !== null && opened !== null) {
    const edges = [
      Math.abs(opened.x - button.x),
      Math.abs(opened.x + opened.width - (button.x + button.width)),
    ];
    expect(Math.min(...edges)).toBeLessThan(1);
    expect(opened.y + opened.height <= button.y || opened.y >= button.y + button.height).toBe(true);
  }

  await picker.click();
  await expect(menu).toBeHidden();
});
