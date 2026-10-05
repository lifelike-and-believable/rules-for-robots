import { expect, test } from '@playwright/test';

test('home links to the products page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Browse products' }).click();
  await expect(page).toHaveURL('/products');
  await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
});

test('lists 12 products and filters them', async ({ page }) => {
  await page.goto('/products');
  const items = page.getByRole('listitem');
  const status = page.getByRole('status');
  await expect(items).toHaveCount(12);
  await expect(status).toHaveText('12 products');

  await page.getByLabel('Search products').fill('mp');
  await expect(items).toHaveCount(2);
  await expect(status).toHaveText('2 products');

  await page.getByLabel('Search products').fill('HEADLAMP');
  await expect(items).toHaveCount(1);
  await expect(status).toHaveText('1 product');
});

test('shows a message when nothing matches', async ({ page }) => {
  await page.goto('/products');
  await page.getByLabel('Search products').fill('zzz-nothing');
  await expect(page.getByRole('status')).toHaveText('No products match');
  await expect(page.getByRole('listitem')).toHaveCount(0);
});

test('the full list is in the server-rendered HTML', async ({ request }) => {
  const html = await (await request.get('/products')).text();
  expect(html.match(/href="\/products\/[a-z-]+"/g)).toHaveLength(12);
});

test('search box is reachable by keyboard', async ({ page }) => {
  await page.goto('/products');
  const search = page.getByLabel('Search products');
  for (let i = 0; i < 5 && !(await search.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(search).toBeFocused();
});

test('a product links to its detail page and back', async ({ page }) => {
  await page.goto('/products');
  await page.getByRole('link', { name: 'Headlamp' }).click();
  await expect(page).toHaveURL('/products/headlamp');
  await expect(page.getByRole('heading', { level: 1, name: 'Headlamp' })).toBeVisible();
  await expect(page.getByText('$45.00')).toBeVisible();
  await page.getByRole('link', { name: 'Back to products' }).click();
  await expect(page).toHaveURL('/products');
});

test('unknown product responds 404', async ({ page }) => {
  const response = await page.goto('/products/does-not-exist');
  expect(response?.status()).toBe(404);
});
