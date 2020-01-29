const common = require('./common');
const discovery = require('dns-discovery');
const resolver = require('mdns-resolver').resolveSrv;
const jsonrpcClients = require('../clients/jsonrpc');

module.exports = (Node) => {
    class ApiHttpDiscovery extends jsonrpcClients(common(Node)) {
        constructor(...args) {
            super(...args);
            var rcConf = this.getConfig(['discovery'], {
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
                resolveMap: { // if we want to resolve name by ourself :)
                    // logger: '192.168.128.255' // ;)
                }
            });
            var {domain, name, map, destinationClients, resolveMap, ...discoveryOptions} = rcConf;
            this.destinationClients = destinationClients;
            this.resolveMap = map;
            this.resolveMap = resolveMap;
            this.resolveName = name;
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
                        this.log('info', {in: 'discovery.announce', domain});
                        this.cleanup.push(() => Promise.resolve().then(() => disc.unannounce(this.resolveName, httpApi.port)).then(() => disc.destroy(() => 1)));
                        disc.announce(this.resolveName, httpApi.port);
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
            this.log('info', {in: 'discovery.resolve.1', description: `try to resolve: ${serviceName}[${sn}]`});
            if (!this.internalRemoteServices[sn]) {
                this.internalRemoteServices[sn] = {resolveResult: 'pending'};
                return this.domain.reduce(async(p, domain) => {
                    try {
                        this.internalRemoteServices[sn].resolver = (this.resolveMap[sn] && Promise.resolve(this.resolveMap[sn])) || resolver(`${sn}.${domain}.local`);
                        this.internalRemoteServices[sn].result = await this.internalRemoteServices[sn].resolver;
                        this.log('info', {in: 'discovery.resolve.2', description: `resolved: ${serviceName}[${sn}]`});
                        this.internalRemoteServices[sn].resolveResult = 'ok';
                        let port = this.internalRemoteServices[sn].result.port;
                        let host = this.internalRemoteServices[sn].result.target.replace('0.0.0.0', '127.0.0.1');
                        this.internalRemoteServices[sn] = {...this.internalRemoteServices[sn], ...this.getClient(serviceName, {remote: {host, port}})};
                        return this.internalRemoteServices[sn].send;
                    } catch (error) {
                        this.internalRemoteServices[sn].resolveResult = 'error';
                        this.internalRemoteServices[sn].error = error;
                        this.log('error', {in: 'discovery.resolve.error.1', description: `can't resolve: ${serviceName}[${sn}]`, error});
                        throw error;
                    }
                }, {});
            } else if (this.internalRemoteServices[sn].resolveResult === 'pending') {
                try {
                    await this.internalRemoteServices[sn].resolver;
                    return this.internalRemoteServices[sn].send;
                } catch (error) {
                    this.log('error', {in: 'discovery.resolve.error.2', destination: sn, error});
                }
            } else if (this.internalRemoteServices[sn].resolveResult === 'error') {
                this.log('error', {in: 'discovery.resolve.error.3', destination: sn, error: this.internalRemoteServices[sn].error});
                this.internalRemoteServices[sn] = undefined;
                return this.resolve(serviceName, apiClient);
            } else if (this.internalRemoteServices[sn].resolveResult === 'ok') {
                this.log('info', {in: 'discovery.resolve.3', description: `resolved: ${serviceName}[${sn}]'}`});
                return this.internalRemoteServices[sn].send;
            }
        }
    }
    return ApiHttpDiscovery;
};
