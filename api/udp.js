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
            this.apiUdpServer = null;
        }

        async start() {
            await super.start();
            this.setStore(
                ['config', 'api'],
                pso(rc(this.getNodeName() || 'buzzer', {
                    api: {
                        port: 8080,
                        address: '0.0.0.0'
                    }
                }).api)
            );
            this.log('info', {in: 'apiUdp.start', message: `api-udp pending: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            await (new Promise((resolve, reject) => {
                server.on('listening', resolve);
                server.on('error', (error) => this.log('error', {in: 'apiUdp.start.error', text: 'udp server error', error}));
                server.on('message', async(buf, rinfo) => {
                    var r = {};
                    var s = buf.toString('utf8');
                    try {
                        r = JSON.parse(s);
                    } catch (e) {
                        this.log('error', {in: 'apiHttp.handler.response', pack: s, error: e});
                    }
                    var {params, method, id = false, meta: {globTraceId} = {}} = r;
                    const msg = {message: params, meta: {method, globTraceId: (globTraceId || uuid()), isNotification: (!id)}};
                    try {
                        let {response = {id}} = await this.apiRequestReceived(msg);
                        return {id, result: response};
                    } catch (e) {
                        this.log('error', {in: 'apiHttp.handler.response', pack: s, error: e});
                    }
                });
                server.bind(this.getStore(['config', 'api']));
                this.apiUdpServer = server;
            }));
            this.log('info', {in: 'apiUdp.start', message: `api-udp ready: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            return this.getStore(['config', 'api']);
        }

        registerApiMethod({method, direction, fn}) {
            direction === 'in' && this.apiRoutes.push({methodName: method});
            super.registerApiMethod({method: [method, direction].join('.'), fn});
        }
        async stop() {
            this.apiUdpServer.close();
            return super.stop();
        }
    }
    return ApiUdp;
};
