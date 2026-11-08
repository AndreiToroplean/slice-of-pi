import { expect, test } from '@playwright/test';

test('shows a digit key’s lingering color as much as the key says', async ({ page }) => {
  await page.goto('/play');
  const key = page.locator('.key[data-key="1"]');
  await expect(key).toBeVisible();

  // The fade itself is timed in `Keypad`: here, only that the key's layer shows what it's at, as it goes.
  const opacity = await key.evaluate((element) => {
    element.style.setProperty('--linger-color', 'red');
    element.style.setProperty('--linger', '0.5');
    return getComputedStyle(element, '::before').opacity;
  });

  expect(opacity).toBe('0.5');
});
