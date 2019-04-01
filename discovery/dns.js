const rc = require('rc');
const discovery = require('dns-discovery');
const jsonrpcClient = {
    http: require('../clients/jsonrpc/http'),
    udp: require('../clients/jsonrpc/udp')
};

const discoveryLookup = (d, timeout = 30000) => {
    return (lookupName) => {
        var p = new Promise((resolve, reject) => {
            var interval = setTimeout(() => reject(new Error('resolveTimeout')), timeout);
            d.on('peer', function(name, peer) {
                if (lookupName === name) {
                    clearTimeout(interval);
                    d.on('peer', () => {});
                    resolve({name, peer});
                }
            });
            d.lookup(lookupName);
        });
        return p
            .catch((e) => {
                d.on('peer', () => {});
                throw e;
            });
    };
};

module.exports = (Node) => {
    class ApiHttpDiscovery extends Node {
        constructor({name = 'Node'} = {}) {
            super();
            var rcConf = rc(name, {
                discovery: {
                    domain: 'testdomain'
                }
            }).discovery;
            this.name = name;
            var {domain, ...discoveryOptions} = rcConf;
            this.domain = domain.split(',');
            this.discoveryOptions = discoveryOptions || {};
            this.cleanup = [];
            this.discoveryDomainCache = {};
            this.internalRemoteServices = {};
        }

        getNodeName() {
            return this.name;
        }

        start() {
            return super.start()
                .then((httpApi) => Promise.resolve().then(() => this.log('info', {in: 'start flow', text: `discovery[${this.name}]: pending`})).then(() => httpApi))
                .then((httpApi) => new Promise((resolve, reject) => {
                    this.domain.map((domain) => {
                        let disc = discovery({domain: `${domain}.local`, ...this.discoveryOptions});
                        this.cleanup.push(() => Promise.resolve().then(() => disc.unannounce(this.name, httpApi.port)).then(() => disc.destroy(this.name, httpApi.port)));
                        disc.announce(this.name, httpApi.port);
                    });
                    resolve();
                }))
                .then(() => this.log('info', {in: 'start flow', text: `discovery[${this.name}]: ready`}));
        }

        stop() {
            return super.stop()
                .then(() => this.cleanup.map((fn) => fn()));
        }

        resolve(serviceName, apiClient) {
            if (!this.internalRemoteServices[serviceName]) {
                return this.domain.reduce((p, domain) => {
                    return p
                        .then(() => {
                            if (!this.discoveryDomainCache[domain]) {
                                this.discoveryDomainCache[domain] = discovery({domain: `${domain}.local`, ...this.discoveryOptions});
                            }
                            return discoveryLookup(this.discoveryDomainCache[domain])(serviceName);
                        })
                        .then(({peer: {host, port}}) => {
                            return {port, host: host.replace('0.0.0.0', '127.0.0.1')};
                        })
                        .then(({host, port}) => (this.internalRemoteServices[serviceName] = jsonrpcClient[apiClient || 'http']({hostname: host, port})))
                        .then(() => this.internalRemoteServices[serviceName]);
                }, Promise.resolve({next: true}));
            }
            return Promise.resolve(this.internalRemoteServices[serviceName]);
        }

        remoteApiRequest({destination, message, meta}) {
            var [nodeName, ...rest] = destination.split('.');
            return this.resolve(nodeName)
                .then((request) => request({method: rest.join('.'), params: (message || {}), meta: Object.assign({}, meta, {source: this.name, destination})}))
                .then((r) => {
                    return r;
                })
                .catch((error) => ({error}));
        }
    }
    return ApiHttpDiscovery;
};
