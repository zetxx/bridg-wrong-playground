const rc = require('rc');
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
                resolve: {
                    map: {
                        logger: 'logger'
                    },
                    nodeName: name,
                    globalPort: 3000
                }
            }).resolve);
            var {nodeName, map, globalPort} = rcConf;
            this.name = nodeName;
            this.resolveMap = map;
            this.globalPort = globalPort;
            this.internalRemoteServices = {};
        }

        getNodeName() {
            return this.name;
        }

        start() {
            return super.start()
                .then((httpApi) => Promise.resolve().then(() => this.log('info', {in: 'discovery.start', text: `discovery[${this.name}]: pending`})).then(() => httpApi))
                .then(() => this.log('info', {in: 'discovery.start', text: `discovery[${this.name}]: ready`}));
        }

        stop() {
            return super.stop();
        }

        async resolve(serviceName, apiClient) {
            var hostname = this.resolveMap[serviceName] || serviceName;
            this.log('info', {in: 'discovery.resolve', args: {serviceName, apiClient, hostname, globalPort: this.globalPort}});
            if (!this.internalRemoteServices[hostname]) {
                this.internalRemoteServices[hostname] = jsonrpcClient[apiClient || 'http']({hostname, port: this.globalPort});
                return this.internalRemoteServices[hostname];
            }
            return this.internalRemoteServices[hostname];
        }

        async remoteApiRequest({destination, message, meta}) {
            var [nodeName, ...rest] = destination.split('.');
            this.log('info', {in: 'discovery.remoteApiRequest', args: {destination, message, meta}});
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
