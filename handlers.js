const { scrapePage, generateShortCode, mimeMap } = require('./funcs');
const fs = require('fs');

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

    try {
        const match = url.match(/\/(p|reel)\/([a-zA-Z0-9_-]+)/);
        if (!match || !match[2]) {
            return reply.code(400).send({ success: false, error: 'URL must contain Instagram post or reel ID' });
        }

        const postId = match[2];
        const page = await browser.newPage();
        const scraped = await scrapePage(page, postId);
        await page.close();

        const content = scraped.map((item, index) => {
            const alt = generateShortCode(item.mimeUrl);
            mimeMap.set(alt, item.mimeUrl);
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
        }
        if (html === 'yes') {
            const htmlPage = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Instagram Media Result</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                    a {
                        color: blue;
                        text-decoration: underline;
                    }
                    ul {
                        padding-left: 20px;
                    }
                    li {
                        margin-bottom: 15px;
                    }
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
            </html>
            `;
            return reply
                .type('text/html')   // ⬅️ Memberi tahu browser ini HTML
                .send(htmlPage);     // ⬅️ Kirim HTML-nya
        }

        reply.code(200).send({
            result: _result
        });
    } 
    catch (err) {
        reply.code(500).send({ 
            success: false, 
            error: err.message 
        });
    }
}

function handleMediaRedirect(request, reply) {
    const { code } = request.params;
    const url = mimeMap.get(code);
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
    reply.send({
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
      return reply.send({
        success: true,
        status: 'logged in'
      });
    }
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      success: false,
      status: 'internal error',
      error: err.message
    });
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
    handleInstagramScrape,
    handleMediaRedirect,
    handleApiStatus,
    handleCheckAuth
};
