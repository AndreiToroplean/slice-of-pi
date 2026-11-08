import { expect, test } from '@playwright/test';

test('shows the stored settings as a page opens, with nothing sliding over to them', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const started: string[] = [];
    Object.assign(window, { started });
    document.addEventListener(
      'transitionrun',
      (event) => {
        if (event.target instanceof Element && event.target.closest('app-segmented') !== null) {
          started.push(event.propertyName);
        }
      },
      true,
    );
  });
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Telephone' }).click();
  await expect(page.getByRole('radio', { name: 'Telephone' })).toBeChecked();

  await page.reload();

  await expect(page.getByRole('radio', { name: 'Telephone' })).toBeChecked();
  expect(await page.evaluate(() => (window as unknown as { started: string[] }).started)).toEqual(
    [],
  );
});
