module.exports = (Node) => {
    class ApiDiscovery extends Node {
        async remoteApiCall({destination, message, meta}) {
            if (this.stopping) {
                this.log('warn', {in: 'discovery.remoteApiCall', description: 'stopping process in progress! message will not be sent', destination, message, meta});
                return undefined;
            }
            var [nodeName, ...rest] = destination.split('.');
            this.log('info', {in: 'discovery.remoteApiCall', description: `try to call micro-service: ${destination}`, destination, message, meta});
            let request = await this.resolve(nodeName);
            return request({method: rest.join('.'), params: (message || {}), meta: Object.assign({}, meta, {source: this.getNodeId(), destination})});
        }
    }
    return ApiDiscovery;
};
