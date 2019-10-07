const dgram = require('dgram');
const udp = dgram.createSocket('udp4');
const uuid = require('uuid/v4');
const {getConfig} = require('../utils');

module.exports = (Node) => {
    class ApiUdp extends Node {
        constructor() {
            super();
            this.apiRoutes = [];
            this.apiUdpServer = null;
        }

        async start() {
            await super.start();
            this.setStore(
                ['config', 'api'],
                getConfig(this.getNodeName() || 'buzzer', ['api'], {
                    type: 'udp',
                    port: 8080,
                    address: '0.0.0.0'
                })
            );
            this.log('info', {in: 'api.udp.start', description: `api-udp pending: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            await (new Promise((resolve, reject) => {
                this.apiUdpServer = udp;
                this.apiUdpServer.on('listening', resolve);
                this.apiUdpServer.on('error', (error) => this.log('error', {in: 'api.udp.start.error', description: 'udp server error', error}));
                this.apiUdpServer.on('message', async(buf, rinfo) => {
                    this.log('trace', {in: 'api.udp.request', args: {buffer: buf}});
                    var r = {};
                    var s = buf.toString('utf8');
                    try {
                        r = JSON.parse(s);
                    } catch (e) {
                        this.log('error', {in: 'apiHttp.handler.response', args: s, error: e});
                    }
                    var {params, method, id = false, meta: {globTraceId} = {}} = r;
                    const msg = {message: params, meta: {method, globTraceId: (globTraceId || {id: uuid(), count: 1}), isNotification: (!id)}};
                    try {
                        let {response = {id}} = await this.apiRequestReceived(msg);
                        return {id, result: response};
                    } catch (e) {
                        this.log('error', {in: 'apiHttp.handler.response', args: s, error: e});
                    }
                });
                this.apiUdpServer.bind(this.getStore(['config', 'api']));
            }));
            this.log('info', {in: 'api.udp.start', description: `api-udp ready: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            return this.getStore(['config', 'api']);
        }

        registerApiMethod({method, direction, fn}) {
            direction === 'in' && this.apiRoutes.push({methodName: method});
            super.registerApiMethod({method: [method, direction].join('.'), fn});
        }
        async stop() {
            this.apiUdpServer && this.apiUdpServer.close(() => (this.apiUdpServer = null));
            return super.stop();
        }
    }
    return ApiUdp;
};
