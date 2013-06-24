var resource = require('resource'),
    auth = resource.use('auth'),
    authGithub = resource.use('auth-github'),
    config = resource.use('config')['github'],
    github = resource.define('github');

github.schema.description = "for interacting with the Github.com API";

function start(options, callback) {
  var gh = require('github'),
      async = require('async');

  // utility function
  function camelCase(input) {
    return input.toLowerCase().replace(/-(.)/g, function(match, group1) {
        return group1.toUpperCase();
    });
  }

  var version = "3.0.0";
  if (typeof config !== 'undefined') {
    version = config.version || version;
  }
  var conn = github.conn = new gh({
    version: version
  });
  async.each(Object.keys(conn[version].routes),
    function(route, callback) {
      // get route info
      var routeMethods = conn[version].routes[route];
      // gh library uses camelCase for resource names
      var ghResourceName = camelCase(route);
      // initialize route resource
      var ghResource = resource.define("github." + ghResourceName);
      // set route resource to be on github
      github[ghResourceName] = ghResource;
      // get route methods from github library
      var ghMethods = conn[ghResourceName];
      // populate route resource with ghMethods
      // based on those in github library
      async.each(Object.keys(routeMethods),
        function(routeMethodName, callback) {
          // gh library uses camelCase for method names
          var ghMethodName = camelCase(routeMethodName);
          // make resource method that uses gh method
          var resourceMethod = function(options, callback) {
            // can we authenticate?
            if (options.user) {
              var userID = options.user.id || options.user;
              // get auth from user
              auth.get(userID, function(err, _auth) {
                if (err) { return callback(err); }
                // get github auth from auth
                authGithub.get(_auth.github, function(err, _authGithub) {
                  // TODO if authGithub not found, execute function
                  if (err) { return callback(err); }
                  // TODO is this safe with multiple users and async?
                  var authenticate = {
                    type: 'oauth',
                    token: _authGithub.credentials.accessToken
                  };
                  // authenticate using credentials
                  conn.authenticate(authenticate);
                  // execute function
                  return ghMethods[ghMethodName](options.msg, callback);
                });
              });
            // if no chance of authentication
            } else {
              // execute function
              return ghMethods[ghMethodName](options.msg, callback);
            }
          };
          // make resource method using msg params in schema
          ghResource.method(ghMethodName, resourceMethod, {
            properties: {
              options: {
                properties: {
                  user: {
                    description: 'user instance or id',
                    type: 'any'
                  },
                  msg: {
                    properties: conn[version].routes[route][routeMethodName].params
                  }
                }
              },
              callback: {
                description: "function to call when the request is finished with an error as first argument and result data as second argument",
                type: 'function'
              }
            }
          });
          return callback(null);
        }, callback);
    }, callback);
}
// TODO change to init
github.method('start', start, {
  description: 'starts the github resource'
});

github.dependencies = {
  "github": "*",
  "async": "*"
};

exports.github = github;