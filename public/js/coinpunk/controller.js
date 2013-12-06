coinpunk.Controller = function() {
};

coinpunk.Controller.prototype.getUnspent = function(confirmations, callback) {
  var self = this;
  var query = {addresses: coinpunk.wallet.addressHashes()};

  if(typeof(confirmations) == 'function')
    callback = confirmations;
  else
    query['confirmations'] = confirmations;

  $.post('/api/tx/unspent', query, function(resp) {
    if(resp.error) {
      coinpunk.router.route('node_error');
      return;
    }

    self.mergeUnspent(resp.unspent, callback);
  });
};

coinpunk.Controller.prototype.mergeUnspent = function(unspent, callback) {
  if(coinpunk.wallet.mergeUnspent(unspent) == true)
    this.saveWallet({override: true}, callback);
  else
    callback();
};

coinpunk.Controller.prototype.saveWallet = function(data, callback) {
  var data = data || {};
  data.serverKey = coinpunk.wallet.serverKey;

  if(!data.payload)
    data.payload = {};

  if(!data.payload.email)
    data.payload.email = coinpunk.wallet.walletId;

  if(!data.payload.wallet)
    data.payload.wallet = coinpunk.wallet.encryptPayload();

  $.ajax({
    type: 'POST',
    url: '/api/wallet',
    data: data,
    dataType: 'json',
    success: function(response) {
      if(callback)
        callback(response);
    }
  });
};

coinpunk.Controller.prototype.deleteWallet = function(serverKey, callback) {
  $.ajax({
    type: 'POST',
    url: '/api/wallet/delete',
    data: {serverKey: serverKey},
    dataType: 'json',
    success: function(response) {
      if(callback)
        callback(response);
    }
  });
};

coinpunk.Controller.prototype.render = function(path, data, callback) {
  this.template('header', 'header');
  this.template('view', path, data, callback);
};

coinpunk.Controller.prototype.template = function(id, path, data, callback) {
  coinpunk.Template.draw(id, path, data, callback);
};

coinpunk.Controller.prototype.friendlyTimeString = function(timestamp) {
  var date = new Date(timestamp);
  return date.toLocaleString();
};

coinpunk.Controller.prototype.updateExchangeRates = function(id) {
  coinpunk.pricing.getLatest(function(price, currency) {
    $('#balanceExchange').text(' ≈ '+ parseFloat(price * $('#balance').text()).toFixed(2) + ' ' + currency);
    $('#exchangePrice').html('1 GLB ≈ ' + price + ' ' + currency + '<br><small><a href="http://globecharts.com" target="_blank">Globe Charts</a></small>');

    $('#'+id+' .exchangePrice').remove();

    var prices = $('#'+id+' .addExchangePrice');
    for(var i=0;i<prices.length;i++) {
      $(prices[i]).append('<span class="exchangePrice"><small>'+($(prices[i]).text().split(' ')[0] * price).toFixed(2)+' ' +currency+'</small></span>');
    }
  });
};

coinpunk.Controller.prototype.minimumSendConfirmations = 1;
coinpunk.Controller.prototype.minimumStrongSendConfirmations = 6;

coinpunk.controllers = {};