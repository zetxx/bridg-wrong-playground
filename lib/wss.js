const {PassThrough} = require('node:stream');
const {createWriteStream} = require('node:fs');
const {WebSocketServer} = require('ws');
const {v4: uuidv4} = require('uuid');
const {counter} = require('bridg-wrong/lib/helpers.js');
const {initMeta} = require('./helpers.js');

const requestCounter = counter();
const wireCounter = counter();
const nodeCounter = counter();

const requestPool = ({log, timeout = 30000}) => {
    const pool = new Map();
    const int = setInterval(() => {
        log(
            'trace',
            `Requests count: ${pool.size}`
        );
    }, 10000);
    const p = {
        add(message) {
            const id = requestCounter();
            const {promise: waiter, resolve, reject} = Promise.withResolvers();
            const timeOut = setTimeout(() => {
                log(
                    'warn',
                    `timeout ${id}`
                );
                pool.delete(id);
                reject(new Error('ResponseTimeout'));
            }, timeout);
            pool.set(id, {
                id,
                timeOut,
                resolve: (...args) => {
                    clearTimeout(timeOut);
                    pool.delete(id);
                    resolve(...args);
                },
                reject: (...args) => {
                    clearTimeout(timeOut);
                    pool.delete(id);
                    reject(...args);
                }
            });
            pool.set(id, {...pool.get(id), waiter});
            return pool.get(id);
        },
        resolve(id, packet) {
            const r = pool.get(id);
            p.remove(id);
            r?.resolve(packet);
        },
        reject(id, error) {
            const r = pool.get(id);
            p.remove(id);
            r?.reject(error);
        },
        get(id) {
            if (!id) {
                return pool;
            }
            return pool.get(id);
        },
        remove(id) {
            const nrq = pool.get(id);
            if (nrq?.timeOut) {
                clearTimeout(nrq.timeOut);
                pool.delete(id);
            }
        },
        stop() {
            clearInterval(int);
            for (const [id] of pool) {
                p.reject(id, new Error('PrematureReject'));
                log('warn', 'PrematureReject');
            }
        }
    };
    return p;
};

const Server = (
    {nodeId, ...wsConfig},
    {
        log = (a) => a,
        mConnected = (args) => args,
        mOk = (payload) => payload,
        mError = (error) => error,
        mClose = (args) => args
    }
) => {
    const connections = new Map();
    let server;

    const o = {
        async init() {
            return await new Promise((resolve, reject) => {
                let initReady = false;
                server = new WebSocketServer(wsConfig);
                server.on('error', (e) => {
                    !initReady && reject(e);
                    log('error', e);
                });
                server.on('listening', () => {
                    log('info', 'Started');
                    initReady = true;
                    resolve();
                });
                server.on('connection', (c, r) => o.connected(c, r));
            });
        },
        connected(client, request) {
            const connectionId = wireCounter();
            connections.set(connectionId, client);
            mConnected({connectionId});
            client.on('message', (m) => mOk(m, {connectionId}));
            client.on('error', (e) => mError(e, {connectionId}));
            client.on('close', () => {
                mClose({connectionId});
                connections.delete(connectionId);
            });
        },
        connTerminate(id) {
            connections.get(id)?.terminate();
        },
        send(connectionId, payload) {
            const connection = connections.get(connectionId);
            if (!connection) {
                log('warn', `No Connection ${connectionId}`);
            }
            connection?.send(payload);
        },
        async stop() {
            return await new Promise((r) => {
                server.on('close', r);
                server.close();
                for (const [, c] of connections) {
                    c.close();
                }
            });
        }
    };
    return o;
};

const Wss = ({prev, config}) => {
    let server;
    let requests;
    let logger;

    class wss extends prev {
        constructor() {
            super();
            this.nodeId = `ws.${config?.nodeId || nodeCounter()}`;
            logger = this.logger([`WSServer[${this.nodeId}]`]);
            if (!config?.sink) {
                const e = new Error('SinkMissing');
                logger.error(e);
                throw e;
            }
            requests = requestPool({
                log: (level, ...a) => logger[level](a),
                timeout: config?.request?.timeout
            });
            server = Server(
                {
                    ...config,
                    nodeId: this.nodeId
                },
                {
                    log: (level, ...a) => logger[level](a),
                    mOk: (a, b) => this.clientFrom(a, b),
                    mError: (_) => this.clientError(_),
                    mClose: (_) => this.clientClose(_),
                    mConnected: (_) => this.clientConnected(_)
                }
            );
        }
        async init() {
            logger.info('Init');
            this.add({
                name: `${this.nodeId}.close`,
                fn: async ({params: {connectionId}}) => {
                    server.connTerminate(connectionId);
                }
            });
            this.add({
                name: `${this.nodeId}.write`,
                fn: async (p) => this.clientTo(p)
            });
            await server.init();
            return super.init && (await super.init());
        }
        async clientTo({id, params, meta: {connectionId: cId}}) {
            const connectionId = Number.parseInt(cId);
            try {
                // notification
                if (!id) {
                    const encoded = this.encode(params);
                    server.send(connectionId, encoded);
                    return;
                }
                const rq = requests.add(params);
                try {
                    const encoded = this.encode({
                        ...params,
                        requestId: rq.id
                    });
                    server.send(connectionId, encoded);
                    const response = await rq.waiter;
                    return response;
                } catch (e) {
                    requests.remove(rq.id);
                    throw e;
                }
            } catch (e) {
                logger.error(['write', e.error || e]);
                throw e;
            }
        }
        async clientFrom(payload, meta) {
            let decoded;
            let response;
            try {
                decoded = this.decode(payload);
                logger.info('received');
                if (decoded.id && requests.get(decoded.id)) {
                    return requests.resolve(decoded.id, decoded);
                }
                if (decoded.id) {
                    throw new Error('ExpiredRequestResponse');
                }
                const resp = this.ask({
                    id: requestCounter(),
                    method: `${config.sink}.message`,
                    params: decoded,
                    meta: {
                        ...initMeta(),
                        connectionId: [this.nodeId, meta.connectionId]
                    }
                });
                if (!decoded.id) {
                    (async () => {
                        try {
                            await resp;
                        } catch (e) {
                            logger.error(['notification', e, decoded]);
                        }
                    })();
                    return;
                }
                // we should respond to client request
                response = await resp;
                const encoded = this.encode({
                    ...(response?.params || {}),
                    id: decoded.id
                });
                server.send(meta.connectionId, encoded);
                // metrics
                const ct = process.hrtime();
                const f = ct[0] - response.meta.passTrough.time[0];
                const s =
                    f < 1
                        ? ct[1] - response.meta.passTrough.time[1]
                        : response.meta.passTrough.time[1] - ct[1];
                logger.debug('message');
            } catch (e) {
                logger.error([e, meta, decoded, response?.params]);
            }
        }
        clientError(e) {
            logger.error(e);
        }
        clientClose({connectionId}) {
            logger.warn(`closing client with id: ${connectionId}`);
        }
        clientConnected({connectionId}) {
            logger.info(`client with id: ${connectionId} connected`);
        }
        async stop() {
            logger.warn('Stopping');
            await server.stop();
            return super.stop && (await super.stop());
        }
    }

    return wss;
};

module.exports = Wss;
