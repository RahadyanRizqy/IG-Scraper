const crypto = require('crypto');
const path = require('path');

const mimeMap = new Map();
const COOKIE_DIR = path.resolve(__dirname, 'ig-credentials');

function generateShortCode(url, length = 10) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const hash = crypto.createHash('sha256').update(url).digest();
    let code = '';
    for (let i = 0; code.length < length && i < hash.length; i++) {
        code += chars[hash[i] % chars.length];
    }
    return code;
}

const scrapePage = async (page, postId) => {
    await page.goto(`https://www.instagram.com/p/${postId}/`, { waitUntil: 'networkidle2' });
    await page.setViewport({ width: 1440, height: 1080 });

    return await page.evaluate(() => {
        const delay = ms => new Promise(res => setTimeout(res, ms));
        const htmlSet = new Set();
        const contentSet = new Set();
        const output = [];

        const extractVideoUrls = () => {
            const videoSet = new Set();
            const videoUrls = [];

            const walk = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj.video_versions)) {
                obj.video_versions.forEach(v => {
                const url = v.url || v.video_url;
                if (url && !videoSet.has(url)) {
                    videoSet.add(url);
                    videoUrls.push(url);
                }
                });
            }
            if (Array.isArray(obj)) {
                obj.forEach(walk);
            } else {
                Object.values(obj).forEach(walk);
            }
            };

            document.querySelectorAll('script[type="application/json"]').forEach(script => {
            try {
                walk(JSON.parse(script.textContent));
            } catch {}
            });

            return videoUrls;
        };

    const extractContent = (element, isCarousel = false) => {
        if (!element) return null;

        const video = element.querySelector('video');

        if (isCarousel) {
        const source = video?.querySelector('source');
        const img = element.querySelector('img');

        if (video?.src) return { content: video.src, type: 'video' };
        if (source?.src) return { content: source.src, type: 'video' };
        if (img?.src) return { content: img.src, type: 'image' };

        const text = element.textContent.trim();
        if (text) return { content: text, type: 'text' };
            return null;
        } else {
        if (video?.src && video.src.startsWith('blob:')) {
            return { content: video.src, type: 'video' };
        }

        const imgTag = element.querySelector('div._aagv img.x5yr21d');
        if (imgTag?.src && imgTag.src.startsWith('http')) {
            return { content: imgTag.src, type: 'image' };
        }

        if (element.src && element.src.startsWith('http')) {
            return { content: element.src, type: 'image' };
        }

        return null;
        }
    };

    const isCarousel = document.querySelector('._acnb') !== null;

    if (isCarousel) {
        return (async () => {
        while (true) {
            document.querySelectorAll('li._acaz').forEach(li => {
            const htmlKey = li.outerHTML;
            if (htmlSet.has(htmlKey)) return;
            htmlSet.add(htmlKey);

            const extracted = extractContent(li, isCarousel);
            if (extracted && !contentSet.has(extracted.content)) {
                contentSet.add(extracted.content);
                output.push({ mimeUrl: extracted.content, mimeType: extracted.type });
            }
            });

            const nextBtn = document.querySelector('button[aria-label="Next"]');
            if (!nextBtn || nextBtn.disabled) break;

            nextBtn.click();
            await delay(1);
        }

        const videoUrls = extractVideoUrls();
        output.filter(item => item.mimeType === 'video').forEach((videoItem, i) => {
            if (videoUrls[i]) videoItem.mimeUrl = videoUrls[i];
        });

        return output;
        })();
    } else {
        const candidates = [
        document.querySelector('article'),
        document.querySelector('div._aagv img.x5yr21d'),
        document.querySelector('video.x5yr21d'),
        ];
        const mediaElement = candidates.find(el => el !== null);
        if (mediaElement) {
        const extracted = extractContent(mediaElement, isCarousel);
        if (extracted) {
            const res = [{ mimeUrl: extracted.content, mimeType: extracted.type }];
            if ((extracted.type === 'video' || extracted.type === 'image') &&
                (extracted.content.startsWith('blob:') || extracted.content.includes('scontent'))) {
            const videoUrls = extractVideoUrls();
            res[0].mimeType = 'video';
            res[0].mimeUrl = videoUrls[0];
            }
            return res;
        }
        }
        return [];
    }
    });
};

module.exports = {
    COOKIE_DIR,
    mimeMap,
    generateShortCode,
    scrapePage,
};
