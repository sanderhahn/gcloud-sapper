// index.js
const server = require('./__sapper__/build/server/server.js');
exports.sapper = (req, res) => {
  const func = process.env.FUNCTION_TARGET;
  req.baseUrl = `/${func}`;
  process.env.TRIGGER_URL = `https://${req.headers.host}/${func}/`;
  server.app(req, res);
};
