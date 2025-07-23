const puppeteer = require('puppeteer');
const fs = require('fs-extra');

(async () => {
  const browser = await puppeteer.launch({ headless: false, userDataDir: './ig-credentials' });
  const page = await browser.newPage();

  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });

  console.log("Press ENTER after login...");
  process.stdin.once('data', async () => {
    await browser.close();
    console.log("✅ Login saved at ig-credentials in workdir");
    process.exit(0);
  });
})();