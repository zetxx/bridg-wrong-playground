const rc = require('rc');
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

        resolve(serviceName, apiClient) {
            var sn = this.resolveMap[serviceName] || serviceName;
            if (!this.internalRemoteServices[sn]) {
                this.internalRemoteServices[sn] = jsonrpcClient[apiClient || 'http']({hostname: sn, port: this.globalPort});
                return this.internalRemoteServices[sn];
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
