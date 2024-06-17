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
const connectionPool = ({
    log,
    timeOut = 1000 * 60 * 10,
    refreshMethods = {read: true, write: true}
}) => {
    const pool = new Map();
    const int = setInterval(() => {
        pool.forEach(({timer, id, socket}) => {
            if (timer + timeOut < Date.now()) {
                socket.emit('close');
                return;
            }
            pool.set(id, {id, socket, timer: Date.now()});
        });
        log(
            'info',
            `Connections count:${pool.size}: `,
            [...pool.keys()],
            [...pool.values()].map(({timer}) => new Date(timer))
        );
    }, 10000);
    return {
        add: ({id, socket}) => {
            pool.set(id, {id, timer: Date.now(), socket});
            return pool.get(id);
        },
        refresh({id, method}) {
            if(!refreshMethods[method]) {
                return pool.get(id);
            }
            let c; 
            if (!(c = pool.get(id))) {
                return false;
            }
            pool.set(
                id,
                {id, timer: Date.now(), socket: c.socket}
            );
            return pool.get(id);
        },
        remove: (id) => {
            pool.delete(id);
        },
        get(id) {
            if(!id) {
                return pool;
            }
            return pool.get(id);
        },
        stop() {
            clearInterval(int);
            pool.forEach(({timer, id, socket}) => {
                socket.emit('close');
            });
        }
    };
};
const requestPool = ({
    log,
    timeOut = 1000 * 60 * 10
}) => {
    const pool = new Map();
    const int = setInterval(() => {
        pool.forEach(({timer, id}) => {
            // timeout catch
        });
        log(
            'info',
            `Requests count:${pool.size}: `,
            [...pool.keys()],
            [...pool.values()].map(({timer}) => new Date(timer))
        );
    }, 10000);
    return {
        add() {},
        reject() {},
        resolve() {},
        stop() {
            clearInterval(int);
            pool.forEach(({timer, id, socket}) => {
                // reject request
            });
        }
    };
};
const Wss = ({
    prev,
    config
}) => {
    class wss extends prev {
        constructor() {
            super();
            this.wssServer = undefined;
            this.dumper = config?.dumpComm && dumpingComm(config?.dumpComm);
            this.requests = new Map();
            this.requests_ = requestPool({
                log: (...a) => this.log(...a)
            });
            this.connections = connectionPool({
                log: (...a) => this.log(...a),
                timeOut: config?.connectionInactivityTimeout,
                refreshMethods: config?.refreshMethods
            });
        }
        async write(message) {
            try {
                const {connectionId, connectionIds} = message.params;
                // notification
                if (!message.id) {
                    const encoded = this.encode({
                        ...message.params
                    });
                    if (!connectionId && !connectionIds) {
                        this.log('warn', 'Wss.server.write', 'no target connection specified');
                        return;
                    } else if (connectionIds instanceof Array) {
                        connectionIds.map((id) => {
                            let connection;
                            if (!(connection = this.connections.get(id))) {
                                return this.log('warn', 'Wss.server.write', 'No Live target connection');
                            } else {
                                this.dumper && this.dumper(encoded, connectionId);
                                this.connections.refresh({id, method: 'write'});
                                connection.socket.send(encoded);
                            }
                        });
                    } else {
                        const connectionId = connectionId;
                        this.dumper && this.dumper(encoded, connectionId);
                        let connection;
                        if (!(connection = this.connections.get(connectionId))) {
                            return this.log('warn', 'Wss.server.write', 'No Live target connection');
                        }
                        connection.socket.send(encoded);
                    }
                    return;
                }
                const connection = this.connections.get(
                    connectionId
                );
                if (!connection) {
                    throw new Error('noTargetConnectionFound');
                }
                // request, it will wait for response, and send data back
                // here we are creating response matcher also
                const rq = this.wsRequest(connection.id, message);
                try {
                    const encoded = this.encode({
                        ...message.params,
                        connectionId: undefined,
                        id: rq.id
                    });
                    this.dumper && this.dumper(encoded, connection.id);
                    connection.socket.send(encoded);
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
                this.log('error', 'Wss.server.write', e?.stack);
                throw e;
            }
        }
        async init() {
            this.log('info', 'Wss.server', 'Init');
            await this.initWssServer();
            this.add({
                name: this.namespace + '.write',
                fn: async(message) =>
                    await this.write(message)
                }
            );
            this.add({
                name: this.namespace + '.close',
                fn: async({params: connectionId, code, reason}) => {
                    this.connections
                        .get(connectionId)
                        .socket
                        .close(code, reason);
                }
            });
            return super.init && await super.init();
        }
        wsRequest(connectionId, message) {
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
        bindEvents(wsClient, {connectionId}) {
            // maybe reject all requests made on this connection
            wsClient.on('close', async() => {
                this.remove({name: connectionId + '.write'});
                this.connections.remove(connectionId);
                try {
                    await this.notify({
                        method: `${config.sink}.disconnected`,
                        params: {},
                        meta: {
                            ...initMeta(),
                            connectionId
                    }});
                } catch (e) {}
                for (const [k, v] of this.requests) {
                    if(v.connectionId === connectionId) {
                        v.reject(new Error('ForceClosingConnection'));
                    }
                }
                wsClient.terminate();
            });
            wsClient.on('error', () => wsClient.close());
            wsClient.on('message', async(data) => {
                this.dumper && this.dumper(data, connectionId, false);
                try {
                    const decoded = this.decode(data);
                    const connection = this.connections.refresh({
                        id: connectionId,
                        method: 'read'
                    });
                    if (!connection) {
                        this.log(
                            'error',
                            'Wss.server.message',
                            'Try to read from unregistered connection',
                            connectionId
                        );
                        return;
                    }
                    // match response if request to device with exact id was send
                    if (decoded.id && this.requests.get(decoded.id)) {
                        return this.requests.get(decoded.id).resolve(decoded);
                    }
                    // nowhere to send message
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
                                this.log('error', 'Wss.server.message', e?.stack);
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
                    if (!this.connections.get(connectionId)) {
                        return this.log(
                            'error',
                            'Wss.server.message',
                            'Try to respond to unregistered connection',
                            connectionId
                        );
                    }
                    connection.send(encoded);
                    // metrics
                    const ct = process.hrtime();
                    const f  = ct[0] - response.meta.passTrough.time[0];
                    const s = (f < 1) ?
                        ct[1] - response.meta.passTrough.time[1] :
                        response.meta.passTrough.time[1] - ct[1];

                        this.log('debug', 'Wss.server.message', `request processed for: ${[f, s].join('.')}`);
                } catch (e) {
                    this.log('error', 'Wss.server.message', e?.stack);
                }
            });
        }
        async initWssServer() {
            return await (new Promise((resolve, reject) => {
                this.wssServer = new WebSocketServer({
                    port: config.port
                });
                this.wssServer.on('error', (error) => {
                    this.log('error', 'Wss.server', error?.stack);
                });
                this.wssServer.on('connection', async(wsClient, req) => {
                    const connectionId = uuidv4();
                    this.connections.add({id: connectionId, socket: wsClient});
                    this.add({
                        name: connectionId + '.write',
                        fn: async(message, {ask, notify}) => {
                            return await this.write(message);
                        }});
                    try {
                        this.log(
                            'info',
                            'Wss.server.connection',
                            `Connection from: ${req.socket.remoteAddress} happen`
                        );
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
                        this.log('error', 'Wss', e?.stack || e?.error?.stack);
                        wsClient.close();
                    }
                });
                this.wssServer.on('listening', () => {
                    this.log('info', 'Wss', 'Listening', this.wssServer.address());
                    resolve();
                });
            }));
        }
        async stop () {
            this.connections.stop();
            this.requests_.stop();
            this.wssServer?.close();
            return super.stop && await super.stop();
        }
    }

    return wss;
};

module.exports = Wss;
