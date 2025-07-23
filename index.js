const fastify = require('fastify')({ logger: true, trustProxy: true });
const cors = require('@fastify/cors');
const multipart = require('@fastify/multipart');
const fastifyStatic = require('@fastify/static');
const path = require('path');
const puppeteer = require('puppeteer');
const callRoutes = require('./routes');
const { COOKIE_DIR } = require('./funcs');

require('dotenv').config();

fastify.decorate('config', {
    port: process.env.SERVER_PORT || 3000,
    host: process.env.SERVER_HOST || '127.0.0.1',
    secretKey: process.env.SECRET_KEY || 'changeme',
    rateLimitPerMinute: process.env.RATE_LIMIT_PER_MINUTE || 5
});

// Dekorasi dulu sebelum route
fastify.decorateRequest('getBaseUrl', function () {
  return `${this.protocol}://${this.headers.host}`;
});

// Lalu baru definisikan rute
fastify.get('/example', async (request, reply) => {
  const baseUrl = request.getBaseUrl(); // Ini akan berisi port juga jika ada
  return { baseUrl };
});

(async () => {
    await fastify.register(cors, { origin: '*' });
    await fastify.register(multipart);
    await fastify.register(fastifyStatic, {
        root: path.join(__dirname, '.'),
        prefix: '/',
    });

    const browser = await puppeteer.launch({
        headless: true,
        userDataDir: COOKIE_DIR,
        defaultViewport: { width: 1440, height: 1080 },
        args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox'],
    });

    callRoutes(fastify, browser, ); // pasang semua route
    await fastify.listen({
        port: fastify.config.port,
        host: fastify.config.host
    });
})();