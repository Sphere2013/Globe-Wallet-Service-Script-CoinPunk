coinpunk.controllers.Tx = function() {};
coinpunk.controllers.Tx.prototype = new coinpunk.Controller();

coinpunk.controllers.Tx.prototype.defaultFee = '0.0005';
coinpunk.controllers.Tx.prototype.minimumConfirmationsToSpend = 1;

coinpunk.controllers.Tx.prototype.details = function(txHash) {
  var self = this;
  $.post('/api/tx/details', {txHashes: [txHash]}, function(resp) {
    self.render('tx/details', {tx: resp[0]}, function(id) {
      $('#'+id+" [rel='tooltip']").tooltip();
    });
  });
};

coinpunk.controllers.Tx.prototype.send = function() {
  var self = this;

  this.getUnspent(function(resp) {
    coinpunk.router.render('view', 'tx/send', {balance: coinpunk.wallet.safeUnspentBalance()}, function(id) {
      self.updateExchangeRates(id, false);
      $('#'+id+" [rel='tooltip']").tooltip();
    });
  });
};

coinpunk.controllers.Tx.prototype.create = function() {
  var self = this;
  var sendButton = $('#sendButton');
  sendButton.addClass('disabled');
  var address = $('#createSendForm #address').val();
  var amount = $('#createSendForm #amount').val();
  var errors = [];
  var errorsDiv = $('#errors');

  errorsDiv.addClass('hidden');
  errorsDiv.html('');

  if(address == '')
    errors.push('You cannot have a blank sending address.');
  else {
    try {
      new Globe.Address(address, coinpunk.config.network);
    } catch (e) {
      errors.push('The provided globe address is not valid.');
    }
  }

  var myAddresses = coinpunk.wallet.addresses();
  
  for(var i=0; i<myAddresses.length;i++) {
    if(myAddresses[i].address == address)
      errors.push('You cannot send to your own globe wallet.');
  }

  if(amount == '' || parseFloat(amount) == 0)
    errors.push('You must have a valid amount to send.');
  else if(/^[0-9]+$|^[0-9]+\.[0-9]+$|^\.[0-9]+$/.exec(amount) === null)
    errors.push('You must have a valid amount to send.');
  else if(coinpunk.wallet.safeUnspentBalance().lessThan(new BigNumber(amount).plus(this.defaultFee))) {
    errors.push('Cannot spend more globes than you currently have.');
  }

  if(errors.length > 0) {
    this.displayErrors(errors, errorsDiv);
    sendButton.removeClass('disabled');
    return;
  }

  var changeAddress = coinpunk.wallet.createNewAddress('change', true);
  var rawtx = coinpunk.wallet.createSend(amount, self.defaultFee, address, changeAddress);
  
  self.saveWallet({override: true, address: changeAddress}, function(response) {
    $.post('/api/tx/send', {tx: rawtx}, function(resp) {
      coinpunk.database.setSuccessMessage("Sent "+amount+" GLB to "+address+".");

      self.getUnspent(function() {
        coinpunk.router.route('dashboard');
      });
    });
  });
};

coinpunk.controllers.Tx.prototype.displayErrors = function(errors, errorsDiv) {
  if(errors.length > 0) {
    errorsDiv.removeClass('hidden');
    
    for(var i=0; i<errors.length; i++) {
      $('#errors').html($('#errors').html() + errors[i]+'<br>');
    }
    return;
  }
};

coinpunk.controllers.Tx.prototype.scanQR = function(event) {
  var errorsDiv = $('#errors');
  var self = this;

  errorsDiv.addClass('hidden');
  errorsDiv.html('');

  if(event.target.files.length != 1 && event.target.files[0].type.indexOf("image/") != 0)
    return this.displayErrors(['You must provide only one image file.'], errorsDiv);

  qrcode.callback = function(result) {
    if(result === 'error decoding QR Code')
      return errorsDiv.removeClass('hidden').html('Could not process the QR code, the image may be blurry. Please try again.');

    var uri = new URI(result);

    if(uri.protocol() != 'globe')
      return errorsDiv.removeClass('hidden').html('Not a valid Globe QR code.');
    
    var address = uri.path();
    if(!address || address == '')
      return errorsDiv.removeClass('hidden').html('No Globe address found in QR code.');

    $('#address').val(address);
    
    var queryHash = uri.search(true);
    
    if(queryHash.amount)
      $('#amount').val(queryHash.amount);
  }

  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');

  var img = new Image();
  img.onload = function() {
    /*
    Helpful URLs: 
    http://hacks.mozilla.org/2011/01/how-to-develop-a-html5-image-uploader/
    http://stackoverflow.com/questions/19432269/ios-html5-canvas-drawimage-vertical-scaling-bug-even-for-small-images
  
    There are a lot of arbitrary things here. Help to clean this up welcome.
    
    context.save();
    context.scale(1e6, 1e6);
    context.drawImage(img, 0, 0, 1e-7, 1e-7, 0, 0, 1e-7, 1e-7);
    context.restore();
    */

    if((img.width == 2448 && img.height == 3264) || (img.width == 3264 && img.height == 2448)) {
      canvas.width = 1024;
      canvas.height = 1365;
      context.drawImage(img, 0, 0, 1024, 1365);
    } else if(img.width > 1024 || img.height > 1024) {
      canvas.width = img.width*0.15;
      canvas.height = img.height*0.15;
      context.drawImage(img, 0, 0, img.width*0.15, img.height*0.15);
    } else {
      canvas.width = img.width;
      canvas.height = img.height;
      context.drawImage(img, 0, 0, img.width, img.height);
    }

    qrcode.decode(canvas.toDataURL('image/png'));
  }

  img.src = URL.createObjectURL(event.target.files[0]);
};

coinpunk.controllers.tx = new coinpunk.controllers.Tx();