import { test, expect } from '@playwright/test';

async function photo(page, width = 1000, height = 1400) {
  const url = await page.evaluate(({ width, height }) => {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const x = c.getContext('2d'); x.fillStyle = '#1b3349'; x.fillRect(0, 0, width, height);
    x.fillStyle = '#f4c44e'; x.fillRect(width * .08, height * .08, width * .84, height * .84);
    x.fillStyle = '#172030'; x.font = `${width / 12}px sans-serif`; x.textAlign = 'center';
    x.fillText('BASKETBALL', width / 2, height * .35); x.fillText('SCAN TEST', width / 2, height * .55);
    return c.toDataURL('image/png');
  }, { width, height });
  return { name: 'basketball.png', mimeType: 'image/png', buffer: Buffer.from(url.split(',')[1], 'base64') };
}

async function generate(page, { label = false, lowResolution = false } = {}) {
  await page.goto('/scan/');
  const image = await photo(page, lowResolution ? 400 : 1000, lowResolution ? 400 : 1400);
  await page.locator('#upload-front').setInputFiles(image);
  if (label) {
    await page.locator('#upload-label').setInputFiles(image);
    await page.locator('#upload-back').setInputFiles(image);
  }
  await expect(page.locator('#toQuality')).toBeEnabled();
  await page.locator('#toQuality').click();
  if (lowResolution) {
    await expect(page.locator('#qualityList')).toContainText('分辨率较低');
    await expect(page.locator('#qualityList')).toContainText('比例与标准卡牌不符');
  } else await expect(page.locator('#qualityList')).toContainText('基础质量良好');
  await page.locator('#toIdentity').click();
  await page.locator('#scanPlayer').fill('COOPER FLAGG');
  await expect(page.locator('[name=jerseyNumber]')).toHaveValue('32');
  await expect(page.locator('[name=teamAbbr]')).toHaveValue('DAL');
  await page.locator('[name=cardNumber]').fill('123');
  await page.locator('[name=serialNumber]').fill('07/25');
  await page.locator('[name=brand]').selectOption('Optic');
  await page.locator('[name=parallel]').selectOption('Gold');
  if (label) {
    await expect(page.locator('#gradeFields')).toBeVisible();
    await page.locator('[name=gradeAgency]').selectOption('PSA');
    await page.locator('[name=gradeScore]').fill('9');
    await page.locator('[name=certNumber]').fill('manual-123');
  }
  await page.locator('#generateCard').click();
  await expect(page.locator('[data-step="4"]')).toBeVisible();
  await expect(page.locator('#threeStatus')).toContainText('PBR');
}

test('local scan saves, survives reload, loads in the editor and retains distinct identifiers', async ({ page }) => {
  const errors = [], uploads = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  page.on('request', request => { if (request.method() !== 'GET') uploads.push(request.url()); });
  await generate(page, { label: true });
  await page.locator('#flipScan').click(); await page.locator('#resetScanView').click();
  await page.screenshot({ path: 'test-results/cardscope-desktop.png', fullPage: true });
  await page.locator('#saveCard').click();
  await expect(page.locator('#savedMessage')).toContainText('已保存');
  expect(uploads).toEqual([]);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('card-builder-library-v1')).cards[0]);
  expect(saved.fullState).toMatchObject({ _scanSource: true, playerName: 'COOPER FLAGG', playerNumber: '32', cardId: '123', cardNum: '07/25', style: 'optic', rarity: 'gold', imageMode: 'fullart', gradeValue: '9', slabType: 'magnetic' });
  expect(saved.fullState._scanResult.candidateMatches).toEqual([]);
  expect(saved.fullState._scanResult.status).toBe('needs-review');
  expect(saved.fullState._scanResult.sourceImages.front.assetId).toBe(saved.fullState.playerImgAssetId);
  expect(saved.fullState._scanResult.sourceImages.label.assetId).toContain(':scan:label');
  expect(saved.fullState._scanResult.sourceImages.back.assetId).toContain(':scan:back');
  await page.locator('#editCard').click();
  await expect(page.locator('#playerName')).toHaveValue('COOPER FLAGG');
  await expect(page.locator('#cardId')).toHaveValue('123');
  await expect(page.locator('#playerNumber')).toHaveValue('32');
  await expect(page.locator('#threeStatus')).toContainText('MAGNETIC');
  expect(await page.evaluate(() => sessionStorage.getItem('cardScanImport'))).toBeNull();
  await page.reload();
  await page.locator('#openLibraryBtn').click();
  await page.locator(`[data-load-id="${saved.id}"]`).click();
  await expect(page.locator('#cardId')).toHaveValue('123');
  await expect.poll(() => page.evaluate(() => window.CardBuilder.getFullState().fullState.playerImg?.startsWith('data:image'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.CardBuilder.getFullState().fullState._scanResult?.sourceImages.label.dataUrl?.startsWith('data:image'))).toBe(true);
  expect(errors).toEqual([]);
});

test('mobile warnings stay nonblocking, manual player and removal work with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await generate(page, { lowResolution: true });
  await page.screenshot({ path: 'test-results/cardscope-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-back="3"]').click();
  await page.locator('#scanPlayer').fill('MY LOCAL PLAYER');
  await page.locator('[name=team]').fill('MY TEAM');
  await page.locator('#generateCard').click();
  await expect(page.locator('#scanSummary')).toContainText('MY LOCAL PLAYER');
  await expect(page.locator('#gradeFields')).toBeHidden();
  await page.locator('[data-back="3"]').click(); await page.locator('[data-back="2"]').click(); await page.locator('[data-back="1"]').click();
  await page.locator('.scan-upload').first().getByRole('button', { name: '移除照片' }).click();
  await expect(page.locator('#toQuality')).toBeDisabled();
});

test('adapter thresholds and all supported style/rarity mappings', async ({ page }) => {
  await page.goto('/scan/');
  const result = await page.evaluate(async () => {
    const a = await import('/scan/card-scan-adapter.js');
    return {
      large: a.checkPhotoQuality({ width: 1000, height: 1400, size: 16 * 1024 * 1024 }),
      styles: ['Prizm', 'Select', 'Mosaic', 'Optic', 'Heritage', 'Tactical', 'Unknown'].map(v => a.mapBrandToSeries(v)),
      rarities: ['Base', 'Silver', 'Gold', 'Neon', 'RWB', 'Black', 'Unknown'].map(a.mapParallelToRarity)
    };
  });
  expect(result.large.issues).toEqual(['large-file']);
  expect(result.styles).toEqual(['prism', 'select', 'mosaic', 'optic', 'heritage', 'tactical', 'prism']);
  expect(result.rarities).toEqual(['base', 'silver', 'gold', 'neon', 'rwb', 'black', 'base']);
});

test('home scan entry and invalid photo recovery', async ({ page }) => {
  await page.goto('/');
  await page.locator('#cardScanLink').click();
  await expect(page).toHaveURL(/\/scan\/$/);
  await page.locator('#upload-front').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.locator('#toast')).toHaveAttribute('data-type', 'error');
  await expect(page.locator('#toQuality')).toBeDisabled();
  await page.locator('#upload-front').setInputFiles(await photo(page));
  await expect(page.locator('#toQuality')).toBeEnabled();
  await page.screenshot({ path: 'test-results/cardscope-upload.png', fullPage: true });
});
