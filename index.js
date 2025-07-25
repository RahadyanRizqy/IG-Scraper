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
    restApi: String(process.env.REST_API).toLowerCase() === 'true',
    logger: String(process.env.LOGGER).toLowerCase() === 'true',
    winSockPath: process.env.WIN_SOCKET,
    unixSockPath: process.env.UNIX_SOCKET
};

const isWindows = process.platform === 'win32';
const socketPath = isWindows ? '\\\\.\\pipe\\myapisocket' : sharedConfig.unixSockPath; // pakai /tmp lebih aman

if (!isWindows && fs.existsSync(socketPath)) {
  try {
    fs.unlinkSync(socketPath);
  } catch (e) {
    console.error('❌ Gagal menghapus socket lama:', e.message);
  }
}

async function setupFastifyInstance(isScoket=false) {
    const fastify = createFastify({ logger: sharedConfig.logger, trustProxy: true });

    const config = { ...sharedConfig, isScoket};
    fastify.decorate('config', config);

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
    
    
    // 🔌 Jalankan HTTP API
    if (sharedConfig.restApi) {
        const httpServer = await setupFastifyInstance(false);
        httpServer.listen({ port: sharedConfig.port, host: sharedConfig.host })
            .then(addr => console.log(`🚀 HTTP API listening at ${addr}`))
            .catch(err => {
            console.error('❌ Gagal listen HTTP:', err);
            process.exit(1);
        });
    }

    // 🔌 Jalankan Unix Socket / Named Pipe
    if (sharedConfig.socket) {
        const socketServer = await setupFastifyInstance(true); // server kedua untuk socket
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