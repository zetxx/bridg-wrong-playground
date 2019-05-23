const rc = require('rc');
const discovery = require('dns-discovery');
const resolver = require('mdns-resolver').resolveSrv;
const pso = require('parse-strings-in-object');
const jsonrpcClient = {
    http: require('../clients/jsonrpc/http'),
    udp: require('../clients/jsonrpc/udp')
};

module.exports = (Node) => {
    class ApiHttpDiscovery extends Node {
        constructor({name = 'Node'} = {}) {
            super();
            var rcConf = pso(rc(name, {
                discovery: {
                    domain: 'testdomain',
                    nameResolve: false,
                    nodeName: name,
                    resolveMap: {
                        logger: 'logger'
                    }
                }
            }).discovery);
            var {domain, nameResolve, nodeName, resolveMap, ...discoveryOptions} = rcConf;
            this.name = nodeName;
            this.resolveMap = resolveMap;
            this.domain = domain.split(',');
            this.nameResolve = nameResolve;
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
            var sn = this.resolveMap[serviceName] || serviceName;
            if (!this.internalRemoteServices[sn]) {
                return this.domain.reduce((p, domain) => {
                    return p.then((resolved) => resolver(`${sn}.${domain}.local`)
                        .then(({port, target}) => ({port, host: (this.nameResolve && sn) || target.replace('0.0.0.0', '127.0.0.1')}))
                        .then(({host, port}) => (this.internalRemoteServices[sn] = jsonrpcClient[apiClient || 'http']({hostname: host, port})))
                        .then(() => this.internalRemoteServices[sn])
                    );
                }, Promise.resolve({next: true}));
            }
            return Promise.resolve(this.internalRemoteServices[sn]);
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
