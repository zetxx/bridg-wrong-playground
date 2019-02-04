const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const uuid = require('uuid/v4');
const rc = require('rc');

module.exports = (Node) => {
    class ApiHttp extends Node {
        constructor() {
            super();
            this.apiRoutes = [];
        }

        start() {
            return super.start()
                .then(() => (
                    this.setStore(
                        ['config', 'api'],
                        rc(this.getNodeName() || 'buzzer', {
                            api: {
                                port: 8080,
                                address: '127.0.0.1'
                            }
                        }).api
                    )
                ))
                .then(() => this.log('info', {in: 'start', message: `api-udp pending: ${JSON.stringify(this.getStore(['config', 'api']))}`}))
                .then(() => (new Promise((resolve, reject) => {
                    server.on('listening', resolve);
                    server.on('error', (error) => this.log('error', {in: 'udp.server:on.error', text: 'udp server error', error}));
                    server.on('message', (buf, rinfo) => {
                        var r = {};
                        try {
                            r = JSON.parse(buf.toString('utf8'));
                        } catch (e) {
                            // @TODO: handle error
                        }
                        var {params, method, id = false, meta: {globTraceId} = {}} = r;
                        const msg = {message: params, meta: {method, globTraceId: (globTraceId || uuid()), isNotification: (!id)}};
                        return this.apiRequestReceived(msg)
                            .then((response = {id: id, error: new Error('unknown error')}) => {
                                return response;
                            })
                            .catch((e) => {
                                return {id: id, error: e};
                            });
                    });
                    server.bind(this.getStore(['config', 'api']));
                })))
                .then(() => this.log('info', {in: 'start', message: `api-udp ready: ${JSON.stringify(this.getStore(['config', 'api']))}`}))
                .then(() => (this.getStore(['config', 'api'])));
        }

        registerApiMethod({method, direction, fn}) {
            direction === 'in' && this.apiRoutes.push({methodName: method});
            super.registerApiMethod({method: [method, direction].join('.'), fn});
        }
    }
    return ApiHttp;
};
