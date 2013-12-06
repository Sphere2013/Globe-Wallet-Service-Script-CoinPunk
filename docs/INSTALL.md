# Coinpunk Installation Procedure

This guide will assist you with installing Coinpunk. This document assumes you are running Ubuntu 12.04 LTS, adjustments may need to be made for other OSes.

If you don't understand how to use this document, **Coinpunk is not for you**. Coinpunk requires a commanding understanding of UNIX system administration to be run safely. If you are learning, you can use Coinpunk's `testnet` mode to ensure that mistakes cannot lead to loss of money.

## System Requirements

A VPS with at least 2GB RAM is needed for the moment, due to the memory usage of globed. This will hopefully be lowered in the future (either from globed becoming more memory efficient, or from Coinpunk switching to a lighter SPV-based node).

## Install Prerequisites

Update your repository data and packages if this is a fresh install of Ubuntu:

```
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install git autoconf libtool libdb4.8 libdb4.8-dev ntp build-essential
```

It is recommended you enable [unattended security updates](https://help.ubuntu.com/community/AutomaticSecurityUpdates) to help protect your system from security issues:

```
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Install NodeJS

The latest information on installing NodeJS for your platform is [available here](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager), this is the current procedure for Ubuntu:

```
sudo apt-get install python-software-properties python g++ make
sudo add-apt-repository ppa:chris-lea/node.js
sudo apt-get update
sudo apt-get install nodejs
```

## Install and Configure Redis

Redis is used to store your wallet data.

```
sudo apt-get install redis-server
```

Now you will need to edit `/etc/redis/redis.conf` to be more data persistent:

Change `appendonly no` to `appendonly yes`.
Change `appendfsync everysec` to `appendfsync always`.

Restart redis: `sudo service redis-server restart`.

## Install and Configure Globed

Currently Coinpunk depends on a custom build of Globed using [this patch](https://github.com/globe/globe/pull/2861).

```
wget https://github.com/sipa/globe/archive/watchonly.tar.gz
tar -zxf watchonly.tar.gz
cd globe-watchonly
sudo add-apt-repository ppa:globe/globe
sudo apt-get update
sudo apt-get install libdb4.8++ libdb4.8++-dev pkg-config libprotobuf-dev libboost-system-dev libboost-filesystem-dev libboost-program-options-dev libboost-thread-dev libminiupnpc8 minissdpd libboost1.48-* ccache
./autogen.sh
./configure --without-qt
make
sudo make install
```

Now you need to configure globed:

```
mkdir -p ~/.globe
vi ~/.globe/globe.conf
```

And add the following information (set the `rpcuser` and `rpcpassword` to something else:

```
rpcuser=NEWUSERNAME
rpcpassword=NEWPASSWORD
txindex=1
testnet=1
```

**If your globed crashes due to memory consumption**, try limiting your connections by adding `maxconnections=10`. Try further adjusting to 3 if you are still having issues.

If you want to run Coinpunk in production rather than on testnet, remove `testnet=1` from the config. Testnet emulates the production Globe network, but does so in a way that you can't lose money. You can send money to your Coinpunk accounts using Globe Testnet Faucets like [the Mojocoin Testnet3 Faucet](http://testnet.mojocoin.com/). I strongly recommend this mode for testing.

Start globed:

```
globed &
```

**Globed will take several hours or more to download the blockchain.** Coinpunk will not be able to function properly until this has occurred. Please be patient.

If you want something to monitor globed to ensure it stays running and start it on system restart, take a look at [Monit](http://mmonit.com/monit/).

## Install and Configure Coinpunk

Go to your user's home directory (`cd ~`), clone the repository and install nodejs dependencies:

```
git clone https://github.com/kyledrake/coinpunk.git
cd coinpunk
npm install
```

Now you will need to create and configure your config.json file, one for the main folder and one in `public`. From the `coinpunk` directory:

```
cp config.template.json config.json
```

Edit the file to connect to `globed`. Use port `18682` for testnet, `8832` for production. Also remove the `testnet` entry for production:

```
{
  "globed": "http://NEWUSERNAME:NEWPASSWORD@127.0.0.1:18682",
  "pricesUrl": "https://bitpay.com/api/rates",
  "testnet": true,
  "httpPort": 8080
}
```

For SSL:

```
{
  "globed": "http://NEWUSERNAME:NEWPASSWORD@127.0.0.1:18682",
  "pricesUrl": "https://bitpay.com/api/rates",
  "testnet": true,
  "httpPort": 8085,
  "httpsPort": 8086,
  "sslKey": "./coinpunk.key",
  "sslCert": "./coinpunk.crt"
}
```

Now copy the client application's config:

```
cp public/config.template.json public/config.json
```

And change `network` to `prod` instead of `testnet` if you are using Coinpunk in production mode.

## Start Coinpunk

You can start Coinpunk from the command line:

```
node start.js -p 10000
```

Where -p is the port number you want to run Coinpunk as.

Try to connect by going to http://YOURADDRESS.COM:10000. If it loads, then you should be ready to use Coinpunk!

## Backing up Database

Redis maintains a file called `/var/lib/redis/dump.rdb`, which is a backup of your Redis database. It is safe to copy this file while Redis is running. **It is strongly recommended that you backup this file frequently.** You can also setup a Redis slave to listen to master in real time. Ideally you should do both!
