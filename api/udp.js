const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const pso = require('parse-strings-in-object');
const uuid = require('uuid/v4');
const rc = require('rc');

module.exports = (Node) => {
    class ApiUdp extends Node {
        constructor() {
            super();
            this.apiRoutes = [];
        }

        start() {
            return super.start()
                .then(() => (
                    this.setStore(
                        ['config', 'api'],
                        pso(rc(this.getNodeName() || 'buzzer', {
                            api: {
                                port: 8080,
                                address: '0.0.0.0'
                            }
                        }).api)
                    )
                ))
                .then(() => this.log('info', {in: 'apiUdp.start', message: `api-udp pending: ${JSON.stringify(this.getStore(['config', 'api']))}`}))
                .then(() => (new Promise((resolve, reject) => {
                    server.on('listening', resolve);
                    server.on('error', (error) => this.log('error', {in: 'apiUdp.start.error', text: 'udp server error', error}));
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
                .then(() => this.log('info', {in: 'apiUdp.start', message: `api-udp ready: ${JSON.stringify(this.getStore(['config', 'api']))}`}))
                .then(() => (this.getStore(['config', 'api'])));
        }

        registerApiMethod({method, direction, fn}) {
            direction === 'in' && this.apiRoutes.push({methodName: method});
            super.registerApiMethod({method: [method, direction].join('.'), fn});
        }
    }
    return ApiUdp;
};
