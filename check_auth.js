const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const cookiesPath = './cookies.json';

  if (!fs.existsSync(cookiesPath)) {
    console.error("❌ File cookies.json tidak ditemukan. Login dulu dan simpan cookies.");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: null,
  });

  const page = await browser.newPage();

  // Load cookies
  const cookies = JSON.parse(fs.readFileSync(cookiesPath));
  await page.setCookie(...cookies);

  // Pergi ke halaman edit profil
  const response = await page.goto('https://www.instagram.com/accounts/edit', {
    waitUntil: 'networkidle2',
  });

  const currentUrl = page.url();

  if (currentUrl.includes('/accounts/login')) {
    console.log("❌ AUTH GAGAL: Diredirect ke halaman login");
  } else {
    console.log("✅ AUTH BERHASIL: Login masih aktif");
  }

  await browser.close();
})();
