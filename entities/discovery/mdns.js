const discovery = require('dns-discovery');
const resolver = require('mdns-resolver').resolveSrv;
const {getConfig} = require('../../utils');
const jsonrpcClient = {
    http: require('../clients/jsonrpc/http'),
    udp: require('../clients/jsonrpc/udp')
};

module.exports = (Node) => {
    class ApiHttpDiscovery extends Node {
        constructor(...args) {
            super(...args);
            var rcConf = getConfig(this.getNodeId(), ['resolve'], {
                // type, only for guessing
                type: 'mdns',
                // member of domain
                domain: 'testDomain',
                // this is node resolve name, if this node name is "xyz",
                // and is member of domain "abc" it will be resolved as xyz.abc
                name: this.getNodeId(),
                // mdns prop
                loopback: false,
                // map destination name to new name
                // for instance if we want to resolve logger as abc-logger
                // we should put in map.logger = 'abc-logger'
                map: {
                    logger: 'logger'
                },
                // how to connect to internal destination: destinationName: proto
                // proto: http/udp
                destinationClients: {
                    logger: 'udp'
                }
            });
            var {domain, nodeName, map, destinationClients, ...discoveryOptions} = rcConf;
            this.destinationClients = destinationClients;
            this.resolveMap = map;
            this.domain = domain.split(',');
            this.discoveryOptions = discoveryOptions || {};
            this.cleanup = [];
            this.discoveryDomainCache = {};
            this.internalRemoteServices = {};
        }

        start() {
            return super.start()
                .then((httpApi) => Promise.resolve().then(() => this.log('info', {in: 'discovery.start', description: `discovery[${this.getNodeId()}]: pending`})).then(() => httpApi))
                .then((httpApi) => new Promise((resolve, reject) => {
                    this.domain.map((domain) => {
                        let disc = discovery({domain: `${domain}.local`, ...this.discoveryOptions});
                        this.cleanup.push(() => Promise.resolve().then(() => disc.unannounce(this.getNodeId(), httpApi.port)).then(() => disc.destroy(() => 1)));
                        disc.announce(this.getNodeId(), httpApi.port);
                    });
                    resolve();
                }))
                .then(() => this.log('info', {in: 'discovery.start', description: `discovery[${this.getNodeId()}]: ready`}));
        }
        async stop() {
            this.cleanup.map((fn) => fn());
            this.cleanup = [];
            Object.keys(this.internalRemoteServices).map((client) => this.internalRemoteServices[client].destroy && setTimeout(this.internalRemoteServices[client].destroy, 1000));
            return super.stop();
        }

        async resolve(serviceName, apiClient) {
            var sn = this.resolveMap[serviceName] || serviceName;
            apiClient = apiClient || this.destinationClients[serviceName];
            this.log('info', {in: 'discovery.resolve', description: `try to resolve: ${serviceName}[${sn}] with api client: ${apiClient || 'http'}`});
            if (!this.internalRemoteServices[sn]) {
                this.internalRemoteServices[sn] = {resolveResult: 'pending'};
                return this.domain.reduce(async(p, domain) => {
                    try {
                        this.internalRemoteServices[sn].resolver = resolver(`${sn}.${domain}.local`);
                        this.internalRemoteServices[sn].result = await this.internalRemoteServices[sn].resolver;
                        this.log('info', {in: 'discovery.resolve', description: `resolved: ${serviceName}[${sn}] with api client: ${apiClient || 'http'}`});
                        this.internalRemoteServices[sn].resolveResult = 'ok';
                        let port = this.internalRemoteServices[sn].result.port;
                        let host = this.internalRemoteServices[sn].result.target.replace('0.0.0.0', '127.0.0.1');
                        this.internalRemoteServices[sn] = {...this.internalRemoteServices[sn], ...jsonrpcClient[apiClient || 'http']({hostname: host, port})};
                        return this.internalRemoteServices[sn].send;
                    } catch (error) {
                        this.internalRemoteServices[sn].resolveResult = 'error';
                        this.internalRemoteServices[sn].error = error;
                        this.log('error', {in: 'discovery.resolve', description: `cannot resolve: ${serviceName}[${sn}] with api client: ${apiClient || 'http'}`, args: {error}});
                        throw error;
                    }
                }, {});
            } else if (this.internalRemoteServices[sn].resolveResult === 'pending') {
                try {
                    await this.internalRemoteServices[sn].resolver;
                    return this.internalRemoteServices[sn].send;
                } catch (error) {
                    this.log('error', {in: 'discovery.resolve', destination: sn, apiClient, error});
                }
            } else if (this.internalRemoteServices[sn].resolveResult === 'error') {
                this.log('error', {in: 'discovery.resolve', destination: sn, apiClient, error: this.internalRemoteServices[sn].error});
                this.internalRemoteServices[sn] = undefined;
                return this.resolve(serviceName, apiClient);
            } else if (this.internalRemoteServices[sn].resolveResult === 'ok') {
                this.log('info', {in: 'discovery.resolve', description: `resolved: ${serviceName}[${sn}] with api client: ${apiClient || 'http'}`});
                return this.internalRemoteServices[sn].send;
            }
        }

        async remoteApiRequest({destination, message, meta}) {
            var [nodeName, ...rest] = destination.split('.');
            this.log('trace', {in: 'discovery.remoteApiRequest', description: `try to call micro-service: ${destination}`, destination, message, meta});
            let request = await this.resolve(nodeName);
            return request({method: rest.join('.'), params: (message || {}), meta: Object.assign({}, meta, {source: this.getNodeId(), destination})});
        }
    }
    return ApiHttpDiscovery;
};
