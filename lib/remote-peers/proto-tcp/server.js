const net = require('node:net');
const {remoteMsgDecode, remoteMsgLen, remoteMsgEncode} = require('../../helpers');

const RemotePeersServer = ({
    prev,
    config = {},
    wires,
    list
}) => {
    class server extends prev({
        prev,
        config,
        wires,
        list
    }) {
        constructor() {
            super();
            this.port = config.port || 0;
        }
        async init() {
            this.serverRMPEERS;
            await this.listener();
            this.log('info', 'RemotePeers -> Server:TCP', 'Init');
            return super.init && await super.init();
        }
        serverDecode(link) {
            let msg = Buffer.from([]);
            let msgLen = 0;
            const refreshInactivityTimeout = () => {
                return setTimeout(
                    () => {
                        this.log('info', 'RemotePeers -> Server:TCP', 'Ending inactive connection');
                        link.end();
                    },
                    (config?.server?.inactivityTimeout || 1000 * 30)
                );
            };
            let inactivityTimeout = refreshInactivityTimeout();
            return async(data) => {
                inactivityTimeout && clearTimeout(inactivityTimeout);
                inactivityTimeout = refreshInactivityTimeout();
                if (!msgLen) {
                    msgLen = remoteMsgLen(data);
                }
                msg = Buffer.concat([msg, data]);
                if (msg.length === msgLen) { // end of message
                    msgLen = 0;
                    const message = remoteMsgDecode(msg);
                    msg = Buffer.from([]);
                    try {
                        const r = await this.ask({
                            ...message,
                            id: undefined
                        });
                        link.write(remoteMsgEncode({
                            ...message,
                            params: r.params
                        }));
                    } catch ({error}) {
                        link.write(remoteMsgEncode({
                            ...message,
                            error,
                            params: undefined
                        }));
                    }
                }
            };
        }
        async listener() {
            return await (new Promise((resolve) => {
                this.serverRMPEERS = net.createServer((link) => {
                    link.on('data', this.serverDecode(link));
                });
                
                this.serverRMPEERS.listen({
                    port: this.port,
                    host: '0.0.0.0'
                }, () => {
                    this.port = this.serverRMPEERS.address().port;
                    resolve();
                });
            }));
        }
        async stop() {
            this.serverRMPEERS?.close();
            super.stop && await super.stop();
        }
    }
    return server;
};

module.exports = RemotePeersServer;
