const puppeteer = require('puppeteer');
const fs = require('fs-extra');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });

  console.log("👤 Silakan login manual di browser. Tekan ENTER jika sudah selesai login...");

  process.stdin.once('data', async () => {
    const cookies = await page.cookies(); // Ambil semua cookies saat ini
    await fs.writeJson('./cookies.json', cookies, { spaces: 2 });

    console.log("✅ Cookies berhasil disimpan di 'cookies.json'");
    console.log("✅ Data login juga tersimpan di folder './ig-credentials'");
    
    await browser.close();
    process.exit(0);
  });
})();
