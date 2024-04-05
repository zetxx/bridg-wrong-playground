const {PassThrough} = require('node:stream');
const {createWriteStream} = require('node:fs');
const {WebSocketServer} = require('ws');
const {v4: uuidv4} = require('uuid');
const {counter} = require('bridg-wrong/lib/helpers.js');
const {initMeta} = require('./helpers.js');

const requestCounter = counter();
const dumpingComm = (fn) => {
    const pass = new PassThrough();
    const writable = createWriteStream(fn);
    pass.pipe(writable);
    const nlb = Buffer.from('\n\n', 'utf8');
    const textRq = Buffer.from('RQ:\n', 'utf8');
    const textRs = Buffer.from('RS:\n', 'utf8');
    const nl = Buffer.from('\n', 'utf8');
    const addPref = (data, connId, isRequest) => {
        if (isRequest) {
            return Buffer.concat([nlb, textRq, connId, nl, data]);
        }
        return Buffer.concat([nlb, textRs, connId, nl, data]);
    };
    return (data, connId, isRequest = true) => {
        pass.write(
            addPref(
                Buffer.from(data, 'utf8'),
                Buffer.from(connId, 'utf8'),
                isRequest
            )
        );
        pass.resume();
    };
};
const Wss = ({
    prev,
    config
}) => {
    class wss extends prev {
        constructor() {
            super();
            this.server = undefined;
            this.dumper = config?.dumpComm && dumpingComm(config?.dumpComm);
            this.requests = new Map();
            this.connections = new Map();
            this.connectionInactivityTimeout = config?.connectionInactivityTimeout ||
                (1000 * 60 * 10);

            const int = setInterval(() => {
                this.log(
                    'info',
                    'Requests count: ',
                    this.requests.size
                );
                this.log(
                    'info',
                    'Connections count: ',
                    this.connections.size,
                    '| Connections by time: ',
                    [...this.connections.values()].map(({time}) => time)
                );
            }, 10000);
            this.intervals = [int];
        }
        async init() {
            this.log('info', 'Wss', 'Init');
            await this.initWssServer();
            this.add({name: this.namespace + '.write', fn: async(message) => {
                try {
                    if (!message.id) {
                        const encoded = this.encode({
                            ...message.params
                        });
                        if (!message.params.connectionId && !message.params.connectionIds) {
                            this.log('warn', 'Wss', 'no target connection');
                            return;
                        } else if (message.params.connectionIds instanceof Array) {
                            for (const [id, conn] of this.connections) {
                                if (message.params.connectionIds.indexOf(id) > -1) {
                                    this.dumper && this.dumper(encoded, connectionId);
                                    this.connection(id)?.send(encoded);
                                }
                            }
                        } else {
                            this.dumper && this.dumper(encoded, message.params.connectionId);
                            const conn = this.connection(message.params.connectionId);
                            if (!conn) {
                                return this.log('warn', 'Wss', 'no target connection');
                            }
                            conn.send(encoded);
                        }
                        return;
                    }
                    if (!this.connection(message.params.connectionId)) {
                        throw new Error('noTargetConnectionFound');
                    }
                    // request, it will wait for response, and send data back
                    // here we are creating response matcher also
                    const rq = this.requestAdd(message.params.connectionId, message);
                    try {
                        const encoded = this.encode({
                            ...message.params,
                            connectionId: undefined,
                            id: rq.id
                        });
                        this.dumper && this.dumper(encoded, message.params.connectionId);
                        this.connection(message.params.connectionId)
                            ?.send(encoded);
                        const response = await rq.wait;
                        return response;
                    } catch (e) {
                        const nrq = this.requests.get(rq.id);
                        if (nrq?.timeOut) {
                            clearTimeout(nrq.timeOut);
                            this.requests.delete(id);
                        }
                        throw e;
                    }
                } catch (e) {
                    this.log('error', 'Wss', e);
                    throw e;
                }
            }});
            return super.init && await super.init();
        }
        requestAdd(connectionId, message) {
            const id = requestCounter();
            const wait = new Promise((resolve, reject) => {
                const timeOut = setTimeout(
                    () => {
                        this.log('info', JSON.stringify(message));
                        this.requests.delete(id);
                        reject(new Error('ResponseTimeout'));
                    },
                    config?.request?.timeout || 30000
                );
                this.requests.set(id, {
                    id,
                    connectionId,
                    resolve: (...args) => {
                        clearTimeout(timeOut);
                        this.requests.delete(id);
                        resolve(...args);
                    },
                    reject: (...args) => {
                        clearTimeout(timeOut);
                        this.requests.delete(id);
                        reject(...args);
                    }
                });
            });
            this.requests.set(id, {...this.requests.get(id), wait});
            return this.requests.get(id);
        }
        bindEvents(wsClient, {
            connectionId
        }) {
            // maybe reject all requests made on this connection
            wsClient.on('close', async() => {
                const conn = this.connections.get(connectionId);
                try {
                    await this.notify({
                        method: `${config.sink}.disconnected`,
                        params: {},
                        meta: {
                            ...initMeta(),
                            connectionId
                    }});
                } catch (e) {}
                if (conn?.timeOut) {
                    clearTimeout(conn.timeOut);
                    this.connections.delete(connectionId);
                    for (const [k, v] of this.requests) {
                        if(v.connectionId === connectionId) {
                            v.reject(new Error('ForceClosingConnection'));
                        }
                    }
                }
                wsClient.terminate();
            });
            wsClient.on('error', () => wsClient.close());
            wsClient.on('message', async(data) => {
                this.dumper && this.dumper(data, connectionId, false);
                try {
                    const decoded = this.decode(data);
                    this.refreshConnection(connectionId);
                    // match response if request to device with exact id was send
                    if (decoded.id && this.requests.get(decoded.id)) {
                        return this.requests.get(decoded.id).resolve(decoded);
                    }
                    // nowhere to send connection event
                    if (!config?.sink) {
                        return;
                    }
                    const resp = this.ask({
                        id: requestCounter(),
                        method: `${config.sink}.message`,
                        params: decoded,
                        meta: {
                            ...initMeta(),
                            connectionId
                        }
                    });
                    // it is notification, return nothing but pass notification request further
                    if (!decoded.id) {
                        (async() => {
                            try {
                                await resp;
                            } catch (e) {
                                this.log('error', 'Wss', e);
                            }
                        })();
                        return;
                    }
                    // we should respond to client request
                    const response = await resp;
                    const encoded = this.encode({
                        ...((response?.params) || {}),
                        id: decoded.id
                    }, decoded);
                    this.dumper && this.dumper(encoded, connectionId);
                    this.connection(connectionId)?.send(encoded);
                    // metrics
                    const ct = process.hrtime();
                    const f  = ct[0] - response.meta.passTrough.time[0];
                    const s = (f < 1) ?
                        ct[1] - response.meta.passTrough.time[1] :
                        response.meta.passTrough.time[1] - ct[1];

                        this.log('debug', 'Wss', `request processed for: ${[f, s].join('.')}`);
                } catch (e) {
                    this.log('error', 'Wss', e);
                }
            });
        }
        refreshConnection(id, connection) {
            const existing = this.connections.get(id);
            if (!existing && !connection) {
                return;
            }
            if (existing?.timeOut) {
                clearTimeout(existing.timeOut);
                if (!connection) { // update only timeout
                    this.connections.set(id, {
                        connection: existing.connection,
                        time: new Date(),
                        timeOut: setTimeout(
                            () => existing?.connection?.close(),
                            this.connectionInactivityTimeout
                        )
                    });
                    return;
                }
            }
            this.connections.set(id, {
                connection,
                time: new Date(),
                timeOut: setTimeout(
                    () => connection?.close(),
                    this.connectionInactivityTimeout
                )
            });
        }
        connection(id) {
            this.refreshConnection(id);
            return this.connections.get(id)?.connection;
        }
        async initWssServer() {
            return await (new Promise((resolve, reject) => {
                this.server = new WebSocketServer({
                    port: config.port
                });
                this.server.on('error', (error) => {
                    this.log('error', 'Wss', error);
                    reject(error);
                });
                this.server.on('connection', async(wsClient, req) => {
                    const connectionId = uuidv4();
                    try {
                        this.log(
                            'info',
                            'Wss',
                            `Connection from: ${req.socket.remoteAddress} happen`
                        );
                        this.refreshConnection(connectionId, wsClient);
                        const request = this.ask({
                            method: `${config.sink}.connected`,
                            params: {},
                            meta: {
                                ...initMeta(),
                                timeout: 30000,
                                connectionId
                            }
                        });
                        this.bindEvents(wsClient, {connectionId});
                        await request;
                    } catch (e) {
                        this.log('error', 'Wss', e);
                        wsClient.close();
                    }
                });
                this.server.on('listening', () => {
                    this.log('info', 'Wss', 'Listening', this.server.address());
                    resolve();
                });
            }));
        }
        async stop () {
            this.intervals.map((int) => clearInterval(int));
            this.server?.close();
            this.server?.terminate();
            return super.stop && await super.stop();
        }
    }

    return wss;
};

module.exports = Wss;
