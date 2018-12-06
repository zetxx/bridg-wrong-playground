const discovery = require('dns-discovery');
const mdnsResolver = require('mdns-resolver');
const jsonrpcClient = require('./jsonrpc-http');
const Node = require('./api-http.js');

class ApiHttpDiscovery extends Node {
    constructor({name = 'Node', domain = 'testdomain', ...rest} = {}) {
        super(rest);
        this.name = name;
        this.domain = `${domain}.local`;
        this.cleanup = [];
        this.internalRemoteServices = {};
    }

    start() {
        return super.start()
            .then((httpApi) => new Promise((resolve, reject) => {
                const disc = discovery({domain: this.domain});
                this.cleanup.push(() => Promise.resolve().then(() => disc.unannounce(this.name, httpApi.port)).then(() => disc.destroy(this.name, httpApi.port)));
                disc.announce(this.name, httpApi.port);
                resolve();
            }));
    }

    stop() {
        return super.stop()
            .then(() => this.cleanup.map((fn) => fn()));
    }

    resolve(serviceName) {
        if (!this.internalRemoteServices[serviceName]) {
            return mdnsResolver.resolveSrv(`${serviceName}.${this.domain}`).then(({port, target}) => ({port, host: target}))
                .then(({host, port}) => (this.internalRemoteServices[serviceName] = jsonrpcClient({hostname: host, port})))
                .then(() => this.internalRemoteServices[serviceName]);
        }
        return Promise.resolve(this.internalRemoteServices[serviceName]);
    }

    remoteApiRequest({destination, message, meta}) {
        var [nodeName, ...rest] = destination.split('.');
        return this.resolve(nodeName)
            .then((request) => request({method: rest.join('.'), params: message || {}}));
    }
}

module.exports = ApiHttpDiscovery;
