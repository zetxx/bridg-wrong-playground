module.exports = (Node) => {
    class ApiDiscovery extends Node {
        async remoteApiRequest({destination, message, meta}) {
            var [nodeName, ...rest] = destination.split('.');
            this.log('info', {in: 'discovery.remoteApiRequest', description: `try to call micro-service: ${destination}`, destination, message, meta});
            let request = await this.resolve(nodeName);
            return request({method: rest.join('.'), params: (message || {}), meta: Object.assign({}, meta, {source: this.getNodeId(), destination})});
        }
    }
    return ApiDiscovery;
};
