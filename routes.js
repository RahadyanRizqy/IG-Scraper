const { handleInstagramScrape, handleMediaRedirect, handleApiStatus, handleCheckAuth } = require('./handlers');

module.exports = function callRoutes(fastify, browser) {
  // Grouping prefix /api
  fastify.get('/api', (_, reply) => { reply.code(302).redirect('/api/status');});

  fastify.register(async function (apiRoutes) {
    apiRoutes.get('/posts', (req, res) => handleInstagramScrape(req, res, browser));
    apiRoutes.post('/posts', (req, res) => handleInstagramScrape(req, res, browser));
    apiRoutes.get('/status', handleApiStatus);
    apiRoutes.get('/media/:code', handleMediaRedirect);
    apiRoutes.get('/check_auth', (req, res) => handleCheckAuth(req, res, browser));
  }, { prefix: '/api' });
};