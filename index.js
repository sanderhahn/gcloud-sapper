// gcloud-sapper/index.js
const server = require('./__sapper__/build/server/server.js');
exports.sapper = (req, res) => {
  // define a path property setter on req
  var path = req.path;
  Object.defineProperty(req, 'path', {
    get: function() {
      return path;
    },
    set: function(newValue) {
      path = newValue;
    },
  });
  server.app.handler(req, res);
};
