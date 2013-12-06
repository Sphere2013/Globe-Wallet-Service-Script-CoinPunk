var express    = require('express');
var redis      = require('redis');
var request    = require('request');
var _          = require('underscore');
var config     = require('./server/config');
var Globed   = require('./server/globed');
var RedisDB    = require('./server/db/redis');
var sockjs     = require('sockjs');
var http       = require('http');
var https      = require('https');
var fs         = require('fs');

var server     = express();

var db = new RedisDB();
db.connect();

var globed = new Globed(config.globed);

var listener = sockjs.createServer({log: function(severity, message) {}});

function listUnspent(addresses, callback) {
  globed.rpc('listunspent', [0, 99999999999999, addresses], function(err, glbres) {
    if(err) {
      return callback(err);
    }

    var unspent = [];

    for(var i=0;i<glbres.length; i++) {
      unspent.push({
        hash:          glbres[i].txid,
        vout:          glbres[i].vout,
        address:       glbres[i].address,
        scriptPubKey:  glbres[i].scriptPubKey,
        amount:        glbres[i].amount,
        confirmations: glbres[i].confirmations
      });
    }

    callback(undefined, unspent);
  });
};

listener.on('connection', function(conn) {
    conn.on('close', function() {});

    conn.on('data', function(message) {
      var req = JSON.parse(message);

      if(req.method == 'listUnspent')
        listUnspent(req.addresses, function(err, unspent) {
          if(err)
            conn.write(JSON.stringify(err));
          else
            conn.write(JSON.stringify({method: 'listUnspent', result: unspent}));
        });
    });
});

server.use(express.json());
server.use(express.urlencoded());
server.use(express.static('public'));
server.use(function(err, req, res, next){
  console.error(err.stack);
  res.send({error: true});
});

server.get('/api/wallet', function(req,res) {
  db.getWallet(req.query.serverKey, function(err, wallet) {
    if(wallet)
      return res.send({wallet: wallet});

    if(err)
      console.log("Wallet Get Error: "+err);

    res.send({result: 'error', message: 'Wallet not found'});
  });
});

server.post('/api/wallet/delete', function(req, res) {
  db.delete(req.body.serverKey, function(err, deleted) {
    if(deleted == true)
      res.send({result: 'success'});
    else
      res.send({result: 'notfound'});
  });
});

function saveWallet(req, res) {
  db.set(req.body.serverKey, req.body.payload, function(err) {
    if(err)
      return res.send({messages: ["Database error: "+JSON.stringify(err)]});
    res.send({result: 'ok'});
  });
};

server.post('/api/wallet', function(req,res) {
  db.getWallet(req.body.serverKey, function(err, wallet) {
    if(err) {
      console.log("Wallet Get Error: "+err);
      return res.send({messages: ['Database error: '+err]});
    }

    if(wallet && !req.body.override)
      return res.send({result: 'exists', wallet: wallet});

    if(req.body.address) {
      globed.rpc('importaddress', [req.body.address, req.body.serverKey, false], function(err, glbres) {
        if(err)
          return res.send({messages: [err.message]});

        saveWallet(req, res);
      });
    } else if(req.body.importAddresses) {
      var batch = [];

      for(var i=0;i<req.body.importAddresses.length;i++)
        batch.push({method: 'importaddress', params: [req.body.importAddresses[i], req.body.serverKey, true], id: i});

      globed.batch(batch, function(err, glbres) {
        if(err)
          return glbres.send({messages: [err.message]});

        saveWallet(req, res);
      });
    } else {
      saveWallet(req, res);
    }
  });
});

server.get('/api/weighted_prices', function(req, res) {
  /*
    For testing offline:
    res.send([{code: 'USD', rate: 40.00}]);
    return;
  */
  try {
    request({uri: config.pricesUrl, method: 'GET'}, function (error, pricesResponse, body) {
      if (!error && pricesResponse.statusCode == 200) {
        res.send(JSON.parse(body));
      } else {
        res.send({error: 'cannot connect to the weighted prices API'});
      }
      return;
    });
  } catch(err)  {
    console.log(err);
    res.send({error: 'cannot connect to the weighted prices API'});
  }
});

server.post('/api/tx/unspent', function(req,res) {
  listUnspent(req.body.addresses, function(err, unspent) {
    if(err)
      return res.send({error: 'globeNode'});

    res.send({unspent: unspent});
  });
});

server.post('/api/tx/details', function(req,res) {
  var i = 0;
  var queries = [];

  if(!req.body.txHashes) {
    res.send([]);
    return;
  }

  for(i=0;i<req.body.txHashes.length;i++) {
    queries.push({method: 'gettransaction', params: [req.body.txHashes[i]]});
  }

  globed.batch(queries, function(err, results) {
    if(err) console.log(err);
    var txes = _.map(results, function(result) {
      result = result.result;
      return {
        hash: result.txid,
        time: result.time,
        amount: result.amount,
        fee: result.fee,
        confirmations: result.confirmations,
        blockhash: result.blockhash,
        blockindex: result.blockindex,
        blocktime: result.blocktime
      };
    });

    res.send(txes);
  });
});

server.post('/api/tx/send', function(req, res) {
  globed.rpc('sendrawtransaction', [req.body.tx], function(err, glbres) {
    if(err)
      return res.send({messages: ['Globed error: '+err]});
    res.send({hash: glbres});
  });
});

if(config.httpsPort || config.sslKey || config.sslCert) {
  var httpsServer = https.createServer({
    key: fs.readFileSync(config.sslKey, 'utf8'),
    cert: fs.readFileSync(config.sslCert, 'utf8')
  }, server);

  listener.installHandlers(httpsServer, {prefix:'/listener'});
  module.exports.httpsServer = httpsServer;

  module.exports.httpServer = http.createServer(function(req, res) {
    if(!req.headers.host)
      res.end();
    res.statusCode = 302;
    var host = req.headers.host;
    var hostname = host.match(/:/g) ? host.slice(0, host.indexOf(":")) : host;
    res.setHeader('Location', 'https://'+hostname+':'+config.httpsPort+'/');
    res.end();
  });
} else {
  console.log('Warning: You are not running in SSL mode!');
  
  var httpServer = http.createServer(server);
  listener.installHandlers(httpServer, {prefix:'/listener'});
  module.exports.httpServer = httpServer;
}

module.exports.config = config;
module.exports.server = server;