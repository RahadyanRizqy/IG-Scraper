const { handleInstagramScrape, handleMediaRedirect, handleApiStatus } = require('./handlers');

module.exports = function callRoutes(fastify, browser) {
  // Grouping prefix /api
  fastify.get('/api', (_, reply) => { reply.code(302).redirect('/api/status');});

  fastify.register(async function (apiRoutes) {
    apiRoutes.get('/posts', (req, res) => handleInstagramScrape(req, res, browser));
    apiRoutes.post('/posts', (req, res) => handleInstagramScrape(req, res, browser));
    apiRoutes.get('/status', handleApiStatus)
    apiRoutes.get('/media/:code', handleMediaRedirect);
  }, { prefix: '/api' });
};