// gcloud-sapper/index.js
const server = require('./__sapper__/build/server/server.js');
exports.sapper = (req, res) => {
    server.app.handler(req, res);
};
