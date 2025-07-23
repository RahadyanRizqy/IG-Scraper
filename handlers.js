const { scrapePage, generateShortCode, mimeMap } = require('./funcs');

function getBaseUrl(request) {
    const protocol = request.protocol;
    const host = request.hostname;
    const port = request.server.config?.port || 80;

    const defaultPort =
        (protocol === 'http' && port === 80) ||
        (protocol === 'https' && port === 443);

    return defaultPort
        ? `${protocol}://${host}`
        : `${protocol}://${host}:${port}`;
    }


async function handleInstagramScrape(request, reply, browser) {
    const url = request.body?.url || request.query?.url;
    const html = request.body?.html ?? 'no';

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

        if (html === 'yes') {
            return 'html!' // DO HERE
        }
        reply.code(200).send({
            success: true,
            instagramUrl: url,
            content,
            timestamp: Date.now()
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

module.exports = {
    handleInstagramScrape,
    handleMediaRedirect,
    handleApiStatus
};
