const discovery = require('dns-discovery');
const {NotFound} = require('bridg-wrong/lib/methods/errors.js');

const RemotePeers = ({
    prev,
    config = {},
    wires,
    list
}) => {
    const proto = (() => {
        if (config?.link?.protocol === 'tcp') {
            return require('./proto-tcp');
        } else if (config?.link?.protocol === 'udp') {
            return require('./proto-udp');
        }
    })();
    class remotePeers extends proto({
        prev,
        config,
        wires,
        list
    }) {
        constructor() {
            super();
            if (!config.domain) {
                throw new Error('domain is required');
            }
            this.disc = discovery({
                domain: config.domain,
                loopback: true
            });
        }
        async discover(name) {
            return await (new Promise((resolve, reject) => {
                let to = setTimeout(() => {
                    if (to) {
                        to = false;
                        reject(new Error('dnsDiscoveryTimeOut'));
                    }
                }, 1000);
                this.disc.once('peer', (name, info) => {
                    if (to) {
                        clearTimeout(to);
                        to = false;
                        resolve({name, info});
                    }
                });
                this.disc.lookup(name);
            }));
        }
        announce({name}) {
            this.log('warn', 'RemotePeers.announce', name, this.port);
            this.disc.announce(name, this.port);
        }
        async add({
            name,
            fn,
            options: {
                response = false,
                exposable = false
            } = {}
        }) {
            !response && exposable && this.announce({name});
            return await super.add({name, fn});
        }
        async send(message, ctx) {
            try {
                return await super.send(message, ctx);
            } catch (e) {
                if (e.error === NotFound) {
                    return await this.remoteOrThrow(message, ctx);
                }
                throw e;
            }
        }
        async stop() {
            this.multicastdns.destroy();
            return (super.stop && await super.stop());
        }
    }
    return remotePeers;
};

module.exports = RemotePeers;
