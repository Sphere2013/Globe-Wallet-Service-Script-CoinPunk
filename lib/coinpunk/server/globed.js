var request = require('request');
var url     = require('url');

function Globed(href, opts) {
  this.opts = opts || {};
  this.url = url.parse(href);
  if(!url.port)
    url.port = 8682;
};

Globed.prototype.rpc = function(method, params, callback) {
  this.request({jsonrpc: '2.0', method: method, params: params}, callback);
};

Globed.prototype.batch = function(cmds, callback) {
  var payload = [];
  for(var i=0;i<cmds.length;i++)
    payload.push({jsonrpc: '2.0', method: cmds[i].method, params: cmds[i].params, id: i});
  this.request(payload, callback);
};

Globed.prototype.request = function(payload, callback) {
  request({uri: this.url.href, method: 'POST', json: payload}, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      if(body.result)
        callback(undefined, body.result);
      else
        callback(undefined, body);   
      return;
    }

    if(error) {
      if(error.message == 'connect ECONNREFUSED') {
        console.log('globed error: connection refused');
        callback({message: "Could not connect to the globe server"});
        return;
      }

      console.log('globed error: unrecognized: '+JSON.stringify(error));
      callback({message: 'Received an unrecognized error from the globe server'});
      return;
    }

    if(response.statusCode == 401) {
      console.log('globed error 401: invalid auth (check your user/pass)');
      callback({message: "Invalid auth"});
    } else {
      if(body)
        console.log('globed error '+response.statusCode+': '+JSON.stringify(body.error));
      else
        console.log('globed error unknown');
      callback({message: 'Received an unrecognized error from the globe server'});
    }
  });
};

module.exports = Globed;