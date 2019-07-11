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
                    loopback: false,
                    nodeName: name,
                    resolveMap: {
                        logger: 'logger'
                    },
                    destinationClients: {}
                }
            }).discovery);
            var {domain, nameResolve, nodeName, resolveMap, destinationClients, ...discoveryOptions} = rcConf;
            this.name = nodeName;
            this.destinationClients = destinationClients;
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
                .then((httpApi) => Promise.resolve().then(() => this.log('info', {in: 'discovery.start', text: `discovery[${this.name}]: pending`})).then(() => httpApi))
                .then((httpApi) => new Promise((resolve, reject) => {
                    this.domain.map((domain) => {
                        let disc = discovery({domain: `${domain}.local`, ...this.discoveryOptions});
                        this.cleanup.push(() => Promise.resolve().then(() => disc.unannounce(this.name, httpApi.port)).then(() => disc.destroy(() => 1)));
                        disc.announce(this.name, httpApi.port);
                    });
                    resolve();
                }))
                .then(() => this.log('info', {in: 'discovery.start', text: `discovery[${this.name}]: ready`}));
        }
        async stop() {
            this.cleanup.map((fn) => fn());
            this.cleanup = [];
            Object.keys(this.internalRemoteServices).map((client) => this.internalRemoteServices[client].destroy && setTimeout(this.internalRemoteServices[client].destroy, 3000));
            return super.stop();
        }

        async resolve(serviceName, apiClient) {
            var sn = this.resolveMap[serviceName] || serviceName;
            apiClient = apiClient || this.destinationClients[serviceName];
            if (!this.internalRemoteServices[sn]) {
                this.internalRemoteServices[sn] = {resolveResult: 'pending'};
                return this.domain.reduce(async(p, domain) => {
                    try {
                        this.internalRemoteServices[sn].resolver = resolver(`${sn}.${domain}.local`);
                        this.internalRemoteServices[sn].result = await this.internalRemoteServices[sn].resolver;
                        this.internalRemoteServices[sn].resolveResult = 'ok';
                        let port = this.internalRemoteServices[sn].result.port;
                        let host = (this.nameResolve && sn) || this.internalRemoteServices[sn].result.target.replace('0.0.0.0', '127.0.0.1');
                        this.internalRemoteServices[sn] = {...this.internalRemoteServices[sn], ...jsonrpcClient[apiClient || 'http']({hostname: host, port})};
                        return this.internalRemoteServices[sn].send;
                    } catch (error) {
                        this.internalRemoteServices[sn].resolveResult = 'error';
                        this.internalRemoteServices[sn].error = error;
                        throw error;
                    }
                }, {});
            } else if (this.internalRemoteServices[sn].resolveResult === 'pending') {
                try {
                    await this.internalRemoteServices[sn].resolver;
                    return this.internalRemoteServices[sn].send;
                } catch (error) {
                    this.log('error', {in: 'discovery.resolve', args: {destination: sn, apiClient}, error});
                }
            } else if (this.internalRemoteServices[sn].resolveResult === 'error') {
                this.log('error', {in: 'discovery.resolve', args: {destination: sn, apiClient}, error: this.internalRemoteServices[sn].error});
                this.internalRemoteServices[sn] = undefined;
            } else if (this.internalRemoteServices[sn].resolveResult === 'ok') {
                return this.internalRemoteServices[sn].send;
            }
        }

        async remoteApiRequest({destination, message, meta}) {
            var [nodeName, ...rest] = destination.split('.');
            this.log('trace', {in: 'discovery.remoteApiRequest', args: {destination, message, meta}});
            let request = await this.resolve(nodeName);
            return request({method: rest.join('.'), params: (message || {}), meta: Object.assign({}, meta, {source: this.name, destination})});
        }
    }
    return ApiHttpDiscovery;
};
