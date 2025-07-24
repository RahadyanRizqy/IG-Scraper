const createFastify = require('fastify');
const cors = require('@fastify/cors');
const multipart = require('@fastify/multipart');
const fastifyStatic = require('@fastify/static');
const path = require('path');
const puppeteer = require('puppeteer');
const callRoutes = require('./routes');
const fs = require('fs');
require('dotenv').config();



// Konfigurasi bersama
const sharedConfig = {
    port: process.env.SERVER_PORT || 3000,
    host: process.env.SERVER_HOST || '127.0.0.1',
    secretKey: process.env.SECRET_KEY || 'changeme',
    rateLimitPerMinute: process.env.RATE_LIMIT_PER_MINUTE || 5,
    headlessValue: String(process.env.HEADLESS).toLowerCase() === 'true',
    socket: String(process.env.SOCKET).toLowerCase() === 'true',
    restfulApi: String(process.env.RESTFUL_API).toLowerCase() === 'true',
    winSockPath: process.env.WIN_SOCKET,
    unixSockPath: process.env.UNIX_SOCKET
};

const isWindows = process.platform === 'win32';
const socketPath = isWindows ? sharedConfig.winSockPath : sharedConfig.unixSockPath; // pakai /tmp lebih aman

if (!isWindows && fs.existsSync(socketPath)) {
  try {
    fs.unlinkSync(socketPath);
  } catch (e) {
    console.error('❌ Gagal menghapus socket lama:', e.message);
  }
}

async function setupFastifyInstance() {
    const fastify = createFastify({ logger: true, trustProxy: true });

    fastify.decorate('config', sharedConfig);

    fastify.decorateRequest('getBaseUrl', function () {
        return `${this.protocol}://${this.headers.host}`;
    });

    await fastify.register(cors, { origin: '*' });
    await fastify.register(multipart);
    await fastify.register(fastifyStatic, {
        root: path.join(__dirname, '.'),
        prefix: '/',
    });

    fastify.get('/example', async (request, reply) => {
        const baseUrl = request.getBaseUrl();
        return { baseUrl };
    });

    const browser = await puppeteer.launch({
        headless: sharedConfig.headlessValue,
        defaultViewport: { width: 1440, height: 1080 },
        args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        ],
    });

    callRoutes(fastify, browser);
    return fastify;
}

(async () => {
    const httpServer = await setupFastifyInstance();
    const socketServer = await setupFastifyInstance(); // server kedua untuk socket

    // 🔌 Jalankan HTTP API
    if (sharedConfig.restfulApi) {
        httpServer.listen({ port: sharedConfig.port, host: sharedConfig.host })
            .then(addr => console.log(`🚀 HTTP API listening at ${addr}`))
            .catch(err => {
            console.error('❌ Gagal listen HTTP:', err);
            process.exit(1);
        });
    }

    // 🔌 Jalankan Unix Socket / Named Pipe
    if (sharedConfig.socket) {
        socketServer.listen({ path: socketPath })
            .then(() => {
                if (!isWindows) fs.chmodSync(socketPath, 0o766);
                console.log(`✅ Socket aktif di ${socketPath}`);
            })
            .catch(err => {
                console.error('❌ Gagal listen socket:', err);
            });
    }
})();
