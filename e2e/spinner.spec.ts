import { expect, test } from '@playwright/test';

test('sets the group size by dragging it up and down', async ({ page }) => {
  await page.goto('/settings');
  const spinner = page.getByRole('spinbutton', { name: 'Group size' });
  await expect(spinner).toHaveAttribute('aria-valuenow', '5');
  // Scrolled into view, and in place, before the press.
  await spinner.hover();
  const box = await spinner.boundingBox();
  if (box === null) {
    throw new Error('No spinner');
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.down();
  // Two steps up, past the spinner itself: the drag goes on wherever the pointer goes.
  await page.mouse.move(x, y - 50, { steps: 5 });
  await expect(spinner).toHaveAttribute('aria-valuenow', '7');
  await page.mouse.move(x, y + 30, { steps: 5 });
  await page.mouse.up();

  await expect(spinner).toHaveAttribute('aria-valuenow', '4');
});
