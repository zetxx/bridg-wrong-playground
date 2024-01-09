const dgram = require('node:dgram');
const {remoteMsgDecode, remoteMsgLen, remoteMsgEncode} = require('./helpers');

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
            await this.listener();
            this.log('info', 'RemotePeers -> Server:UDP', 'Init');
            return super.init && await super.init();
        }
        serverDecode(link, writer) {
            let msg = Buffer.from([]);
            let msgLen = 0;
            const refreshInactivityTimeout = () => {
                return setTimeout(
                    () => {
                        this.log('info', 'RemotePeers -> Server:UDP', 'Ending inactive connection');
                        link.end && link.end();
                    },
                    (config?.server?.inactivityTimeout || 1000 * 30)
                );
            };
            let inactivityTimeout = refreshInactivityTimeout();
            return async(data, info) => {
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
                    let response;
                    try {
                        const r = await this.ask({
                            ...message,
                            id: undefined
                        });
                        response = {
                            ...message,
                            params: r.params
                        };
                    } catch ({error}) {
                        response = {
                            ...message,
                            error,
                            params: undefined
                        };
                    }
                    writer(remoteMsgEncode(response), info);
                }
            };
        }
        async listener() {
            return await (new Promise((resolve) => {
                const server = dgram.createSocket('udp4');
                server.on(
                    'message',
                    this.serverDecode(
                        server,
                        (data, info) => {
                            server.send(data, info);
                        }
                    )
                );
                
                server.bind(
                    this.port,
                    '0.0.0.0',
                    () => {
                        this.port = server.address().port;
                        resolve();
                    });
            }));
        }
    }
    return server;
};

module.exports = RemotePeersServer;
