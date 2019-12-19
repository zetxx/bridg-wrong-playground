const dgram = require('dgram');
const udp = dgram.createSocket('udp4');
const {constructJsonrpcRequest} = require('../../utils');

module.exports = (Node) => {
    class ApiUdp extends Node {
        constructor(...args) {
            super(...args);
            this.apiRoutes = [];
            this.apiUdpServer = null;
        }

        async start() {
            await super.start();
            this.setStore(
                ['config', 'api'],
                this.getConfig(['api'], {
                    type: 'udp',
                    port: 8080, // listen port
                    address: '0.0.0.0' // listen address
                })
            );
            this.log('info', {in: 'api.udp.start', description: `api-udp pending: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            await (new Promise((resolve, reject) => {
                this.apiUdpServer = udp;
                this.apiUdpServer.on('listening', () => {
                    this.log('trace', {in: 'api.udp.on.listening', args: {config: this.getStore(['config', 'api'])}});
                    resolve();
                });
                this.apiUdpServer.on('error', (error) => this.log('error', {in: 'api.udp.on.error', description: 'udp server error', args: {error}}));
                this.apiUdpServer.on('message', async(buf, rinfo) => {
                    this.log('info', {in: 'api.udp.on.message', request: buf});
                    var r = {};
                    var s = buf.toString('utf8');
                    try {
                        r = JSON.parse(s);
                    } catch (e) {
                        this.log('error', {in: 'api.udp.on.message', s, error: e});
                    }
                    let {id} = r;
                    let msg = constructJsonrpcRequest(r);
                    try {
                        let {response = {id}} = await this.apiRequestReceived(msg);
                        this.log('info', {in: 'api.udp.on.message', response: response});
                        return {id, result: response};
                    } catch (e) {
                        this.log('error', {in: 'api.udp.on.message', args: {s, error: e}});
                    }
                });
                this.apiUdpServer.bind(this.getStore(['config', 'api']));
            }));
            this.log('info', {in: 'api.udp.start', description: `api.udp ready: ${JSON.stringify(this.getStore(['config', 'api']))}`});
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