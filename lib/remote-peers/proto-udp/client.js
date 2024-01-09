const dgram = require('node:dgram');
const {remoteMsgDecode, remoteMsgLen, remoteMsgEncode} = require('./helpers');
const {NotFound} = require('bridg-wrong/lib/methods/errors.js');
const {counter} = require('bridg-wrong/lib/helpers.js');

const requestCount = counter();

const RemotePeersClient = ({
    prev,
    config = {},
    wires,
    list
}) => {
    class client extends prev({wires, list}) {
        constructor() {
            super();
            this.connections = new Map();
            this.requests = new Map();
        }
        refreshInactivityTimeout(connectionId) {
            const con = this.connections.get(connectionId);
            const inactivityTimeout = setTimeout(
                () => {
                    this.log('info', 'RemotePeers -> Client:UDP', `Ending connection: ${connectionId}`);
                    con?.client?.end && con.client.end();
                },
                (config?.client?.inactivityTimeout || 1000 * 60 * 2)
            );
            if (!con) {
                return inactivityTimeout;
            }
            clearTimeout(con.inactivityTimeout);
            con.inactivityTimeout = inactivityTimeout;
            this.connections.set(connectionId, con);
        }
        clientDecode(connectionId) {
            let msg = Buffer.from([]);
            let msgLen = 0;
            return (data) => {
                this.refreshInactivityTimeout(connectionId);
                if (!msgLen) {
                    msgLen = remoteMsgLen(data);
                }
                msg = Buffer.concat([msg, data]);
                if (msg.length === msgLen) { // end of message
                    msgLen = 0;
                    const message = remoteMsgDecode(msg);
                    msg = Buffer.from([]);
                    const rq = this.requests.get(message.id);
                    if (!rq) {
                        return this.log(
                            'warn',
                            'RemotePeers -> Client',
                            'Received message with non existing id',
                            message
                        );
                    }
                    clearTimeout(rq.timeout);
                    this.requests.delete(message.id);
                    if (message.error) {
                        return rq.reject({
                            ...rq.message,
                            params: undefined,
                            error: [rq.message.method, message.error].join('>')
                        });
                    }
                    rq.resolve({
                        ...rq.message,
                        params: message.params
                    });
                }
            };
        }
        async requester({host, port}) {
            const connectionId = this.connectionId({host, port, proto: 'udp'});
            return await (new Promise((resolve) => {
                const t = this.connections.get(connectionId); // do we have connection to host:port endpoint ?
                if (t) {
                    return resolve();
                }
                const client = dgram.createSocket('udp4');
                client.connect(port, host, () => {
                    this.connections.set(connectionId, {
                        client,
                        inactivityTimeout: this.refreshInactivityTimeout(
                            connectionId
                        )
                    });
                    client.on('end', () => {// what to do when connection is closed
                        const con = this.connections.get(connectionId);
                        clearTimeout(con.inactivityTimeout);
                        this.connections.delete(connectionId);
                    });
                    client.on('message', this.clientDecode(connectionId));
                    resolve();
                });
            }));
        }
        connectionId({host, port, proto}) {
            return [proto, host, port].join(':');
        }
        connection({host, port, proto}) {
            return this.connections.get(
                this.connectionId({proto, host, port})
            ).client;
        }
        async remoteOrThrow(message) {
            try {
                const discovered = await this.discover(message.method);
                if (!discovered?.info?.host) {
                    throw new Error('DiscoveryFailed');
                }
                await this.requester(discovered?.info);
                const id = requestCount();
                return new Promise((resolve, reject) => {
                    const requestTimeout = setTimeout(() => {
                        this.requests.delete(id);
                        reject({error: NotFound});
                    }, config?.timeout || 5000);
                    this.requests.set(id, {
                        resolve,
                        reject,
                        timeout: requestTimeout,
                        message
                    });
                    this.connection(discovered?.info)
                        .write(remoteMsgEncode({
                            ...message,
                            id
                        }));
                });
            } catch (e) {
                throw {error: e};
            }
        }
    }
    return client;
};

module.exports = RemotePeersClient;
