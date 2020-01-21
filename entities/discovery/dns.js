const common = require('./common');
const jsonrpcClients = require('../clients/jsonrpc');

module.exports = (Node) => {
    class ApiHttpDiscovery extends jsonrpcClients(common(Node)) {
        constructor(...args) {
            super(...args);
            var rcConf = this.getConfig(['discovery'], {
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
                this.internalRemoteServices[hostname] = this.getClient(serviceName, {remote: {host: hostname, port: this.globalPort}});
                return this.internalRemoteServices[hostname].send;
            }
            return this.internalRemoteServices[hostname].send;
        }
    }
    return ApiHttpDiscovery;
};
