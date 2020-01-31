const clients = {
    http: require('./http'),
    udp: require('./udp')
};

module.exports = (Node) => {
    class internalRemoteServices extends Node {
        constructor(...params) {
            super(...params);
            this.serviceConfigCache = {};
            this.remoteClients = {};
        }

        getClientConfig(client, props) {
            if (!this.serviceConfigCache[client]) {
                this.serviceConfigCache[client] = this.getConfig(['internalServiceClient', client], {
                    // how to connect to internal destination: destinationName: proto
                    proto: 'http',
                    timeout: 120000,
                    // used in udp
                    listen: (props && props.listen) || {
                        host: false,
                        port: 0
                    },
                    // where to send packets
                    remote: (props && props.remote) || {
                        host: false,
                        port: 0,
                        tunnel: false
                    }
                });
            }
            return this.serviceConfigCache[client];
        }

        getClient(client, props) {
            if (!this.remoteClients[client]) {
                let config = this.getClientConfig(client, props);
                this.remoteClients[client] = clients[config.proto](config, (...args) => this.log(...args), {cleanupMeta: (m) => this.cleanMeta(m).meta});
            }
            return this.remoteClients[client];
        }
    }

    return internalRemoteServices;
};
