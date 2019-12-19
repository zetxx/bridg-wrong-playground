const jsonrpcClient = {
    http: require('../clients/jsonrpc/http'),
    udp: require('../clients/jsonrpc/udp')
};

module.exports = (Node) => {
    class ApiHttpDiscovery extends Node {
        constructor(...args) {
            super(...args);
            var rcConf = this.getConfig(['resolve'], {
                // map destination name to new name
                map: {
                    logger: 'logger'
                },
                type: 'dns',
                // to which port to connect to
                globalPort: 3000,
                // how to connect to internal destination: destinationName: proto
                // proto: http/udp
                destinationClients: {
                    logger: 'udp'
                }
            });
            var {map, globalPort, destinationClients} = rcConf;
            this.destinationClients = destinationClients;
            this.resolveMap = map;
            this.globalPort = globalPort;
            this.internalRemoteServices = {};
        }

        async start() {
            this.log('info', {in: 'discovery.start', description: `discovery[${this.getNodeId()}]: pending`});
            let prev = await super.start();
            this.log('info', {in: 'discovery.start', description: `discovery[${this.getNodeId()}]: ready`});
            return prev;
        }

        async stop() {
            Object.keys(this.internalRemoteServices).map((client) => setTimeout(this.internalRemoteServices[client].destroy, 1000));
            return super.stop();
        }

        async resolve(serviceName, apiClient) {
            var hostname = this.resolveMap[serviceName] || serviceName;
            apiClient = apiClient || this.destinationClients[serviceName];
            this.log('info', {in: 'discovery.resolve', serviceName, apiClient, hostname, globalPort: this.globalPort});
            if (!this.internalRemoteServices[hostname]) {
                this.internalRemoteServices[hostname] = jsonrpcClient[apiClient || 'http']({hostname, port: this.globalPort});
                return this.internalRemoteServices[hostname].send;
            }
            return this.internalRemoteServices[hostname].send;
        }

        async remoteApiRequest({destination, message, meta}) {
            var [nodeName, ...rest] = destination.split('.');
            this.log('trace', {in: 'discovery.remoteApiRequest', destination, message, meta});
            let request = await this.resolve(nodeName);
            return request({method: rest.join('.'), params: (message || {}), meta: Object.assign({}, meta, {source: this.getNodeId(), destination})});
        }
    }
    return ApiHttpDiscovery;
};