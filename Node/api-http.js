const Node = require('bridg-wrong');
const Hapi = require('hapi');

class ApiHttp extends Node {
    constructor({httpApiPort = 80} = {}) {
        super();
        this.configApi = {
            httpServer: {
                port: httpApiPort,
                address: '0.0.0.0'
            }
        };
        this.apiRoutes = [];
    }

    start() {
        return super.start()
            .then(() => (new Promise((resolve, reject) => {
                const server = Hapi.server(this.configApi.httpServer);
                server.route({
                    method: '*',
                    path: '/JSONRPC/{method*}',
                    handler: (request, h) => ({id: -1, error: 'MethodNotFound'})
                });
                this.apiRoutes.map(({methodName, ...route}) => server.route(Object.assign({
                    method: 'POST',
                    path: `/JSONRPC/${methodName}`,
                    handler: (request, h) => {
                        return this.apiRequestReceived({message: {}, meta: {method: methodName}})
                            .then((response = 'empty') => ({response: response}))
                            .catch(() => ({error: true}));
                    }
                }, route)));
                server.events.on('start', resolve);
                server.start();
            })))
            .then(() => console.log('api-http ready', this.configApi.httpServer))
            .then(() => (this.configApi.httpServer));
    }

    registerApiMethod({method, direction, fn}) {
        direction === 'in' && this.apiRoutes.push({methodName: method});
        super.registerApiMethod({method: [method, direction].join('.'), fn});
    }

    externalOut({message, meta}) {
        return this.externalIn({message, meta});
    }
}

module.exports = ApiHttp;
