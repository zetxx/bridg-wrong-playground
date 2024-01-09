const {WebSocketServer} = require('ws');
const {v4: uuidv4} = require('uuid');
const {counter} = require('bridg-wrong/lib/helpers.js');

const requestCounter = counter();

const Internal = ({config, encode, decode, log}) => {
    let server;
    const internalApi = {
        requests: new Map(),
        connections: new Map(),
        requestAdd() {
            const id = requestCounter();
            const internalId = `int.${id}`;
            internalApi.requests.set(internalId, {id});
            internalApi.requests.set(internalId, {
                id,
                wait: new Promise((resolve, reject) => {
                    internalApi.requests.set(internalId, {
                        resolve: (...args) => {
                            internalApi.requests.delete(internalId);
                            resolve(...args);
                        },
                        reject: (...args) => {
                            internalApi.requests.delete(internalId);
                            reject(...args);
                        },
                        ...internalApi.requests.get(internalId)
                    });
                }),
                ...internalApi.requests.get(internalId)
            });
            return internalApi.requests.get(internalId);
        },
        async connect({send}) {
            const startRes = new Promise((resolve, reject) => {
                server = new WebSocketServer({
                    port: config.port
                });
                server.on('connection', (wsClient) => {
                    const connectionId = uuidv4();
                    internalApi.connections.set(connectionId, wsClient);
                    (async() => {
                        try {
                            log('info', 'Wss', `Connection happen, sending to: ${config.sink}.connected`);
                            await send({
                                method: `${config.sink}.connected`,
                                params: {},
                                meta: {passTrough: {traceId: uuidv4(), time: process.hrtime()}, connectionId}
                            });
                        } catch (e) {
                            log('error', 'Wss', e);
                        }
                    })();
                    wsClient.on('message', async(data) => {
                        try {
                            const decoded = decode(data);
                            const internalId = `int.${decoded.id}`;
                            // match response if request to device with exact id was send
                            if (decoded.id && internalApi.requests.get(internalId)) {
                                return internalApi.requests.get(internalId).resolve(decoded);
                            }
                            const resp = send({
                                id: requestCounter(),
                                method: `${config.sink}.message`,
                                params: decoded,
                                meta: {passTrough: {traceId: uuidv4(), time: process.hrtime()}, connectionId}
                            });
                            // it is notification, return nothing but pass notification request further
                            if (!decoded.id) {
                                (async() => {
                                    try {
                                        await resp;
                                    } catch (e) {
                                        log('error', 'Wss', e);
                                    }
                                })();
                                return;
                            }
                            // we should respond to client request
                            const response = await resp;
                            const encoded = encode({
                                ...((response?.params) || {}),
                                id: decoded.id
                            }, decoded);
                            wsClient.send(encoded);
                            // metrics
                            const ct = process.hrtime();
                            const f  = ct[0] - response.meta.passTrough.time[0];
                            const s = (f < 1) ?
                                ct[1] - response.meta.passTrough.time[1] :
                                response.meta.passTrough.time[1] - ct[1];

                            log('debug', 'Wss', `request processed for: ${[f, s].join('.')}`);
                        } catch (e) {
                            log('error', 'Wss', e);
                        }
                    });
                });
                server.on('error', (error) => {
                    log('error', 'Wss', error);
                    reject(error);
                });
                server.on('listening', () => {
                    log('info', 'Wss', 'Listening', server.address());
                    resolve(internalApi);
                });
            });
            return startRes;
        },
        server() {
            return server;
        }
    };
    return internalApi;
};

const Wss = ({
    prev,
    config,
    wires,
    list
}) => {
    class wss extends prev({wires, list}) {
        constructor() {
            super();
            this.internal = Internal({
                config,
                encode: this.encode,
                decode: this.decode,
                log: (...args) => this.log(...args)
            });
        }
        async init() {
            this.log('info', 'Wss', 'Init');
            await this.internal.connect({send: (...args) => this.send(...args)});
            this.add({name: this.namespace + '.write', fn: async(message) => {
                try {
                    if (!message.id) { // notification, can be used as a response of smthng, like , doing smth on initial connection
                        const encoded = this.encode({
                            ...message.params
                        });
                        if (!message.params.connectionId) {
                            this.log('warn', 'Wss', 'no target connection');
                            return;
                        } else if (message.params.connectionId === 'all') { // broadcast send
                            for (const [, conn] of this.internal.connections) {
                                conn.send(encoded);
                            }
                        } else {
                            this.internal.connections.get(message.params.connectionId).send(encoded);
                        }
                        return;
                    }
                    // request, it will wait for response, and send data back
                    // here we are creating response matcher also
                    const rq = this.internal.requestAdd();
                    const encoded = this.encode({
                        ...message.params,
                        ...({connectionId: undefined}),
                        id: rq.id
                    });
                    this.internal.connections.get(message.params.connectionId).send(encoded);
                    const response = await rq.wait;
                    return response;
                } catch (e) {
                    this.log('error', 'Wss', e);
                }
            }});
            return super.init && await super.init();
        }
        async stop () {
            await this.internal.server().close();
            return super.stop && await super.stop();
        }
    }

    return wss;
};

module.exports = Wss;
