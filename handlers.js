const { scrapePage, generateShortCode, mimeMap } = require('./funcs');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_TTL = 2 * 60 * 1000; // 2 menit

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}

function getBaseUrl(request) {
    const protocol = request.headers['x-forwarded-proto'] || request.protocol;
    const host = request.headers['host'];

    // Pecah host dan port jika ada
    const [hostname, port] = host.split(':');

    const isDefaultPort =
        (protocol === 'http' && (!port || port === '80')) ||
        (protocol === 'https' && (!port || port === '443'));

    return isDefaultPort
        ? `${protocol}://${hostname}`
        : `${protocol}://${hostname}:${port}`;
}

function generateHtmlResult(_result) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Instagram Media Result</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            a { color: blue; text-decoration: underline; }
            ul { padding-left: 20px; }
            li { margin-bottom: 15px; }
        </style>
    </head>
    <body>
        <h2>Instagram Media Result</h2>
        <p><strong>Success:</strong> ${_result.success}</p>
        <p><strong>Instagram URL:</strong> 
            <a href="${_result.instagramUrl}" target="_blank">${_result.instagramUrl}</a>
        </p>
        <h3>Content:</h3>
        <ul>
            ${_result.content.map(item => `
                <li>
                    <strong>Index:</strong> ${item.index}<br>
                    <strong>MIME Type:</strong> ${item.mimeType}<br>
                    <strong>Mime URL:</strong> 
                    <a href="${item.mimeUrl}" target="_blank">${item.mimeUrl}</a><br>
                    <strong>Alternative URL:</strong> 
                    <a href="${item.alternativeUrl}" target="_blank">${item.alternativeUrl}</a>
                </li>
            `).join('')}
        </ul>
        <p><strong>Timestamp:</strong> ${_result.timestamp}</p>
    </body>
    </html>`;
}

async function handleInstagramScrape(request, reply, browser) {
    const url = request.body?.url || request.query?.url;
    const html = request.query?.html ?? 'no';
    const baseUrl = getBaseUrl(request);

    if (!url || typeof url !== 'string') {
        return reply.code(400).send({ success: false, error: 'Invalid URL' });
    }

    if (!html || typeof html !== 'string') {
        return reply.code(400).send({ success: false, error: 'Invalid answer' });
    }

    const match = url.match(/\/(p|reel)\/([a-zA-Z0-9_-]+)/);
    if (!match || !match[2]) {
        return reply.code(400).send({ success: false, error: 'URL must contain Instagram post or reel ID' });
    }

    const postId = match[2];
    const cachePath = path.join(CACHE_DIR, `${postId}.json`);

    // ⏳ Cek cache
    if (fs.existsSync(cachePath)) {
        const stats = fs.statSync(cachePath);
        const age = Date.now() - stats.mtimeMs;
        if (age < CACHE_TTL) {
            const raw = fs.readFileSync(cachePath, 'utf-8');
            const _result = JSON.parse(raw);
            if (html === 'yes') {
                return reply.type('text/html').send(generateHtmlResult(_result));
            }
            return reply.code(200).send({ result: _result });
        } else {
            fs.unlinkSync(cachePath); // expired, hapus
        }
    }

    try {
        const page = await browser.newPage();
        const scraped = await scrapePage(page, postId);
        await page.close();

        const content = scraped.map((item, index) => {
            const alt = generateShortCode(item.mimeUrl);
            mimeMap.set(alt, item.mimeUrl);
            // console.log(mimeMap)
            return {
                index,
                mimeUrl: item.mimeUrl,
                mimeType: item.mimeType,
                alternativeUrl: `${baseUrl}/api/media/${alt}`,
            };
        });

        const _result = {
            success: true,
            instagramUrl: url,
            content,
            timestamp: Date.now()
        };

        // 💾 Simpan ke cache file
        fs.writeFileSync(cachePath, JSON.stringify(_result), 'utf-8');

        if (html === 'yes') {
            return reply.type('text/html').send(generateHtmlResult(_result));
        }

        return reply.code(200).send({ result: _result });

    } catch (err) {
        return reply.code(500).send({ success: false, error: err.message });
    }
}

function handleMediaRedirect(request, reply) {
    const { code } = request.params;
    const url = mimeMap.get(code);
    // console.log(mimeMap);
    if (url) {
        reply.redirect(url);
    } else {
        reply.code(404).send({ 
            success: false, 
            error: 'Media not found' 
        });
    }
}

async function handleApiStatus(_, reply) {
    return reply.send({
        status: 'ok',
        message: 'API is running',
    });
};

async function handleCheckAuth(request, reply, browser) {
  const cookiesPath = './cookies.json';
  try {
    const page = await browser.newPage();
    const cookies = JSON.parse(fs.readFileSync(cookiesPath));
    await page.setCookie(...cookies);

    await page.goto('https://www.instagram.com/accounts/edit', {
      waitUntil: 'networkidle2',
    });

    const currentUrl = page.url();

    if (currentUrl.includes('/accounts/login')) {
      return reply.send({
        success: false,
        status: 'logged out'
      });
    } else {
        await page.close();
        return reply.send({
            success: true,
            status: 'logged in'
        });
    }
  } catch (err) {
        request.log.error(err);
        await page.close();
        return reply.status(500).send({
            success: false,
            status: 'internal error',
            error: err.message
        });
  } finally {
    if (browser) await page.close();
  }
}

module.exports = {
    handleInstagramScrape,
    handleMediaRedirect,
    handleApiStatus,
    handleCheckAuth
};
