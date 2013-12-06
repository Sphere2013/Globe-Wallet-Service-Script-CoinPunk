coinpunk.controllers.Dashboard = function() {};

coinpunk.controllers.Dashboard.prototype = new coinpunk.Controller();

coinpunk.controllers.Dashboard.prototype.renderDashboard = function() {
  var i = 0;
  var self = this;
  $('#balance').text(coinpunk.wallet.safeUnspentBalance());
  $('#pendingBalance').text(coinpunk.wallet.pendingUnspentBalance());

  var txHashes = [];
  var txs = coinpunk.wallet.transactions;

  for(i=0;i<txs.length;i++) {
    txHashes.push(txs[i].hash);
  }

  $.post('/api/tx/details', {txHashes: txHashes}, function(resp) {
    for(i=0;i<txs.length;i++) {
      for(var j=0;j<resp.length;j++) {
        if(txs[i].hash == resp[j].hash)
          txs[i].confirmations = resp[j].confirmations;
      }
    }

    var stxs = [];
    for(i=0;i<txs.length;i++)
      if(txs[i].type == 'send')
        stxs.push(txs[i]);

    var rtxs = [];
    for(i=0;i<txs.length;i++)
      if(txs[i].type == 'receive')
        rtxs.push(txs[i]);

    self.template('sentTransactions', 'dashboard/sent', {tx: stxs}, function(id) {
      $('#'+id+" [rel='tooltip']").tooltip();
      self.updateExchangeRates(id);
    });

    self.template('receivedTransactions', 'dashboard/received', {category: 'Received', tx: rtxs}, function(id) {
      self.updateExchangeRates('receivedTransactions');
      $('#'+id+" [rel='tooltip']").tooltip();
    });
  });
};

coinpunk.controllers.Dashboard.prototype.index = function() {
  var i = 0;
  var self = this;

  this.render('dashboard', {}, function() {
    if(!self.firstDashboardLoad) {
      self.firstDashboardLoad = true;
      self.getUnspent(function() {
        self.renderDashboard();
      });
    } else {
      self.renderDashboard();
    }
    self.template('addresses', 'dashboard/addresses', {addresses: coinpunk.wallet.addresses()});
  });
};

coinpunk.controllers.Dashboard.prototype.updateExchangeRates = function(id) {
  coinpunk.pricing.getLatest(function(price, currency) {
    $('#balanceExchange').text(' ≈ '+ parseFloat(price * $('#balance').text()).toFixed(2) + ' ' + currency);
    $('#exchangePrice').html('1 GLB ≈ ' + price + ' ' + currency);

    $('#'+id+' .exchangePrice').remove();

    var prices = $('#'+id+' .addExchangePrice');
    for(var i=0;i<prices.length;i++) {
      $(prices[i]).append('<span class="exchangePrice pull-right"><small>'+($(prices[i]).text().split(' ')[0] * price).toFixed(2)+' ' +currency+'</small></span>');
    }
  });
};

coinpunk.controllers.Dashboard.prototype.generateNewAddress = function(label) {
  var self = this;
  var label = label || '';
  var address = coinpunk.wallet.createNewAddress(label, false);

  this.saveWallet({address: address, override: true}, function() {
    self.template('addresses', 'dashboard/addresses', {addresses: coinpunk.wallet.addresses()});
    $('#newAddressDialog').removeClass('hidden');
    var message = 'Created new address '+address;
    if(label != '')
      var message = message + ' with label '+label;
    $('#newAddressMessage').html(message+'.');
  });
};

coinpunk.controllers.dashboard = new coinpunk.controllers.Dashboard();