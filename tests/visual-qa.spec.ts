import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browserMessages = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const messages: string[] = [];
  browserMessages.set(page, messages);
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    messages.push(`pageerror: ${error.message}`);
  });
});

function expectNoBrowserErrors(page: Page) {
  expect(browserMessages.get(page) ?? []).toEqual([]);
}

test('calculator renders and core controls respond', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/Solar PV LCOE Calculator/);
  await expect(page.getByRole('heading', { name: 'Solar PV LCOE Calculator' })).toBeVisible();
  await expect(page.getByText('Solar LCOE').first()).toBeVisible();
  await expect(page.locator('.bigResult')).toContainText('$');

  const initialLcoe = await page.locator('.bigResult').innerText();
  await page.getByRole('button', { name: 'Off' }).click();
  await expect(page.locator('.resultPanel').getByText('ITC face value')).toBeVisible();
  await expect(page.locator('.bigResult')).not.toHaveText(initialLcoe);

  await page.getByRole('button', { name: 'AC', exact: true }).click();
  await expect(page.locator('.inputs').getByText('DC/AC ratio')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('solar-lcoe-scenario.csv');

  expectNoBrowserErrors(page);

  await mkdir('qa-artifacts', { recursive: true });
  const screenshotPath = `qa-artifacts/${testInfo.project.name}-desktop-flow.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('desktop flow screenshot', { path: screenshotPath, contentType: 'image/png' });
});

test('mobile layout puts results first and remains readable', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(page.locator('.resultPanel')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy scenario link' })).toBeVisible();
  await expect(page.getByText('Primary inputs')).toBeVisible();

  const resultBox = await page.locator('.resultPanel').boundingBox();
  const inputBox = await page.getByText('Primary inputs').boundingBox();
  expect(resultBox?.y ?? 9999).toBeLessThan(inputBox?.y ?? 0);

  expectNoBrowserErrors(page);

  await mkdir('qa-artifacts', { recursive: true });
  const screenshotPath = `qa-artifacts/${testInfo.project.name}-mobile.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('mobile screenshot', { path: screenshotPath, contentType: 'image/png' });
});
