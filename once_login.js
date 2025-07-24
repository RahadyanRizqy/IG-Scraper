const puppeteer = require('puppeteer');
const fs = require('fs-extra');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    userDataDir: './ig-credentials',
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });

  console.log("👤 Silakan login manual. Tekan ENTER jika sudah selesai login...");
  process.stdin.once('data', async () => {
    await browser.close();
    console.log("✅ Login tersimpan di folder ./ig-credentials");
    process.exit(0);
  });
})();
