const fs = require('fs-extra');
const path = require('path');

const CACHE_DIR = path.resolve(__dirname, 'cache');
const CACHE_TTL = 2 * 60 * 1000; // 2 menit

fs.ensureDirSync(CACHE_DIR);

function getCacheKey(req) {
  if (req.method === 'GET') {
    return path.join(CACHE_DIR, Buffer.from(req.url).toString('base64') + '.json');
  } else {
    const hash = Buffer.from(JSON.stringify(req.body)).toString('base64');
    return path.join(CACHE_DIR, hash + '.json');
  }
}

async function fastifyCacheMiddleware(req, reply) {
  const key = getCacheKey(req);

  if (await fs.pathExists(key)) {
    const stat = await fs.stat(key);
    const isExpired = Date.now() - stat.mtimeMs > CACHE_TTL;

    if (!isExpired) {
      const cachedData = await fs.readJSON(key);
      reply.header('x-cache', 'HIT');
      return reply.send(cachedData);
    } else {
      await fs.remove(key);
    }
  }

  // Hook untuk menyimpan respon
  const originalSend = reply.send.bind(reply);
  reply.send = async (payload) => {
    try {
      await fs.writeJSON(key, payload);
    } catch (err) {
      console.error('❌ Gagal menyimpan cache:', err);
    }
    return originalSend(payload);
  };
}

module.exports = { fastifyCacheMiddleware };
