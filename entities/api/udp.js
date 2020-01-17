const dgram = require('dgram');
const udp = dgram.createSocket('udp4');
const Api = require('./main');
const {serializeError} = require('serialize-error');

module.exports = (Node) => {
    class ApiUdp extends Api(Node) {
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
                    this.log('trace', {in: 'api.udp.on.listening', config: this.getStore(['config', 'api'])});
                    resolve();
                });
                this.apiUdpServer.on('error', (error) => this.log('error', {in: 'api.udp.on.error', description: 'udp server error', error}));
                this.apiUdpServer.on('message', async(buf, rinfo) => {
                    this.log('info', {in: 'api.udp.on.message', request: buf});
                    var s = buf.toString('utf8');
                    try {
                        let result = await this.callApiMethod(s);
                        return rinfo.port && rinfo.address && this.respond(result, rinfo);
                    } catch (error) {
                        let {id} = error;
                        this.log('error', {in: 'api.udp.on.message', s, error});
                        return rinfo.port && rinfo.address && this.respond({id, error: serializeError(error)}, rinfo);
                    }
                });
                this.apiUdpServer.bind(this.getStore(['config', 'api']));
            }));
            this.log('info', {in: 'api.udp.start', description: `api.udp ready: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            return this.getStore(['config', 'api']);
        }

        respond(response, rinfo) {
            let client = dgram.createSocket('udp4');
            client.send(Buffer.from(JSON.stringify(response), 'utf8'), rinfo.port, rinfo.address, () => {
                this.log('trace', {in: 'api.udp.response.sent'});
                client.close();
            });
        }

        async stop() {
            this.apiUdpServer && this.apiUdpServer.close(() => (this.apiUdpServer = null));
            return super.stop();
        }
    }
    return ApiUdp;
};
