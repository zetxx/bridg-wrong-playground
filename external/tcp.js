const net = require('net');
const pso = require('parse-strings-in-object');
const rc = require('rc');
const uuid = require('uuid/v4');
const codec = () => ({encode: (msg) => Promise.resolve(msg), decode: (msg) => Promise.resolve(msg)});

const rqMsgLen = (msg) => {
    let len = parseInt(msg.slice(0, 2).toString('hex'), 16);
    if (msg.length > 2) {
        return len;
    }
};
const msgHeaderLen = 2;

module.exports = (Node) => {
    class Tcp extends Node {
        constructor({codec, ...rest}) {
            super(rest);
            this.codec = codec;
        }
        start() {
            var codecCofnig = rc(this.getNodeName() || 'buzzer', {
                codec: {
                    macCheck: false
                }
            }).codec;
            var c = (this.codec && this.codec(codecCofnig)) || codec({});
            this.encode = c.encode.bind(c);
            this.decode = c.decode.bind(c);
            this.receivedBuffer = Buffer.from('');
            this.connected = false;
            this.socket = undefined;
            this.lib = {...this.lib, connect: () => this.connect()};
            return super.start()
                .then(() => (
                    this.setStore(
                        ['config'],
                        {
                            tcp: pso(rc(this.getNodeName() || 'buzzer', {
                                tcp: {
                                    host: 'localhost', // to wich host to connect (where switch is listening)
                                    port: 5000, // to wich port to connect  (where switch is listening)
                                    responseTimeout: 10000 // throw timeout error after period of time (ms)
                                }
                            }).tcp)
                        }
                    )
                ))
                .then(() => setTimeout(() => !this.connected && this.triggerEvent('externalDisconnected'), 5000)); // if only network gets restarted, send dissconect event if it is not connected
        }
        connect() {
            this.log('debug', {in: 'tcp.connect', text: 'connection initialisation'});
            return new Promise((resolve, reject) => {
                if (!this.connected) {
                    this.socket = net.createConnection({port: this.getStore(['config', 'tcp', 'port']), host: this.getStore(['config', 'tcp', 'host'])});
                    this.socket.on('data', (data) => this.dataReceived(data));
                    this.socket.on('connect', () => {
                        this.log('debug', {in: 'tcp.connect', text: 'connected'});
                        this.connected = true;
                        this.socket.on('error', (e) => {
                            this.log('error', {in: 'tcp.connect.error', error: e});
                            throw e;
                        });
                        this.log('info', {in: 'tcp.connect', text: 'network connected'});
                        resolve();
                    });
                    this.socket.on('error', (e) => {
                        this.log('error', {in: 'tcp.connect.error', error: e});
                    });
                    this.socket.on('close', (e) => {
                        this.connected = false;
                        this.log('warn', {in: 'tcp.connect', text: 'connectionClosed'});
                        this.triggerEvent('externalDisconnected');
                    });
                } else {
                    this.socket.end();
                }
            });
        }

        triggerEvent(event, message = {}) {
            this.log('debug', {in: 'tcp.triggerEvent', event, message});
            return this.findExternalMethod({method: `event.${event}`})
                .then((fn) => fn(this.getInternalCommunicationContext({direction: 'in'}), message, {}))
                .catch((error) => this.log('error', {in: 'tcp.triggerEvent', error}));
        }

        getIncomingMessages(messages = []) {
            this.log('debug', {in: 'tcp.getIncomingMessages', messages});
            var len = rqMsgLen(this.receivedBuffer);
            if ((this.receivedBuffer.length - msgHeaderLen) >= len) {
                messages.push(this.receivedBuffer.slice(msgHeaderLen, len + msgHeaderLen));
                this.receivedBuffer = this.receivedBuffer.slice(len + msgHeaderLen);
                if (this.receivedBuffer.length > 0) {
                    return this.getIncomingMessages(messages);
                }
            }
            return messages;
        }

        dataReceived(data) {
            this.log('debug', {in: 'tcp.dataReceived'});
            this.receivedBuffer = Buffer.concat([this.receivedBuffer, data]);
            this.getIncomingMessages()
                .map((msgBuf) => Promise.resolve(msgBuf)
                    .then((buffer) => {
                        this.log('debug', {in: 'tcp.dataReceived', buffer: buffer.toString('hex')});
                        return buffer;
                    })
                    .then((buffer) => this.externalIn({result: buffer})) // send parsed msg to terminal
                    .catch((e) => (this.log('error', {in: 'tcp.dataReceived', error: e})))
                );
        }

        matchExternalInToTx(result) {
            this.log('debug', {in: 'tcp.matchExternalInToTx', result});
            var idxRspMatch = this.apiRequestsPool.findIndex(({meta: {responseMatchKey} = {}} = {}) => {
                if (responseMatchKey && responseMatchKey.messageCoordinationNumber && result && result.messageCoordinationNumber) {
                    return result.messageCoordinationNumber === responseMatchKey.messageCoordinationNumber;
                }
                return false;
            });
            if (idxRspMatch >= 0) {
                var apiRequestId = this.apiRequestsPool[idxRspMatch].meta.apiRequestId;
                return {apiRequestId};
            }
            return {};
        }

        externalIn({result}) {
            this.log('debug', {in: 'tcp.externalIn', result});
            return this.decode(result)
                .then(({parsed}) => {
                    this.log('debug', {in: 'tcp.externalIn', parsed});
                    var result = parsed;
                    const globTraceId = uuid();
                    var {apiRequestId} = this.matchExternalInToTx(result);
                    return super.externalIn({result, meta: {method: ((apiRequestId && 'networkCommandResponse') || 'networkCommand'), globTraceId, apiRequestId}});
                })
                .catch((error) => this.log('error', {in: 'tcp.externalIn', error}));
        }

        externalOut({result, error, meta}) {
            this.log('debug', {in: 'tcp.externalOut', result, error, meta});
            if (error) {
                return Promise.resolve({error})
                    .then(() => {
                        return this.socket.end(() => this.socket.destroy());
                    });
            }
            return this.encode(result)
                .then((buffer) => {
                    this.log('debug', {in: 'tcp.externalOut', worldOutBuffer: buffer.toString('hex')});
                    return this.socket.write(buffer);
                })
                .catch((e) => {
                    return this.log('error', {in: 'tcp.externalOut', error: e});
                });
        }
    }

    return Tcp;
};
