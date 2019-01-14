const net = require('net');
const codec = () => ({encode: (msg) => Promise.resolve(msg), decode: (msg) => Promise.resolve(msg)});
const rc = require('rc');
const uuid = require('uuid/v4');

const rqMsgLen = (msg) => {
    let len = parseInt(msg.slice(0, 2).toString('hex'), 16);
    if (msg.length > 2) {
        return len;
    }
};
const msgHeaderLen = 2;

module.exports = (Node) => {
    class Net extends Node {
        constructor({codec, ...rest}) {
            super(rest);
            this.codec = codec;
        }
        start() {
            var c = (this.codec && this.codec()) || codec({});
            this.encode = c.encode.bind(c);
            this.decode = c.decode.bind(c);
            this.receivedBuffer = Buffer.from('');
            this.connected = false;
            this.socket = undefined;
            return super.start()
                .then(() => (
                    this.setState(
                        ['config'],
                        {
                            tcp: rc(this.getNodeName() || 'buzzer', {
                                tcp: {
                                    host: 'localhost', // to wich host to connect (where switch is listening)
                                    port: 5000, // to wich port to connect  (where switch is listening)
                                    responseTimeout: 10000 // throw timeout error after period of time (ms)
                                }
                            }).tcp
                        }
                    )
                ))
                .then(() => setTimeout(() => !this.connected && this.triggerEvent('externalDisconnected'), 5000)); // if only network gets restarted, send dissconect event if it is not connected
        }
        connect() {
            this.log('info', {in: 'connect', text: 'connection initialisation'});
            return new Promise((resolve, reject) => {
                if (!this.connected) {
                    this.socket = net.createConnection({port: this.getState(['config', 'tcp', 'port']), host: this.getState(['config', 'tcp', 'host'])});
                    this.socket.on('data', (data) => this.dataReceived(data));
                    this.socket.on('connect', () => {
                        this.log('info', {in: 'connect', text: 'connected'});
                        this.connected = true;
                        this.socket.on('error', (e) => {
                            this.log('error', {in: 'connect', error: e});
                            throw e;
                        });
                        this.log('info', {in: 'connect', text: 'network connected'});
                        resolve();
                    });
                    this.socket.on('error', (e) => {
                        this.log('error', {in: 'connect', error: e});
                    });
                    this.socket.on('close', (e) => {
                        this.connected = false;
                        this.log('warn', {in: 'connect', text: 'connectionClosed'});
                        this.triggerEvent('externalDisconnected');
                    });
                } else {
                    this.socket.end();
                }
            });
        }

        triggerEvent(event, message = {}) {
            this.log('info', {in: 'triggerEvent', event, message});
            return this.findExternalMethod({method: `event.${event}`})
                .then((fn) => fn(this.getInternalCommunicationContext({direction: 'in'}), message, {}))
                .catch((error) => this.log('error', {in: `method:triggerEvent`, error}));
        }

        getIncomingMessages(messages = []) {
            this.log('info', {in: 'getIncomingMessages', messages});
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
            this.log('info', {in: 'dataReceived'});
            this.receivedBuffer = Buffer.concat([this.receivedBuffer, data]);
            this.getIncomingMessages()
                .map((msgBuf) => Promise.resolve(msgBuf)
                    .then((buffer) => {
                        this.log('info', {in: 'dataReceived', buffer: buffer.toString('hex')});
                        return buffer;
                    })
                    .then((buffer) => this.externalIn({result: buffer})) // send parsed msg to terminal
                    .catch((e) => (this.log('error', {in: 'dataReceived', error: e})))
                );
        }

        matchExternalInToTx(result) {
            this.log('info', {in: 'matchExternalInToTx', result});
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
            this.log('info', {in: 'externalIn', result});
            return this.decode(result)
                .then(({parsed}) => {
                    this.log('info', {in: 'externalIn', parsed});
                    var result = parsed;
                    const globTraceId = uuid();
                    var {apiRequestId} = this.matchExternalInToTx(result);
                    return super.externalIn({result, meta: {method: ((apiRequestId && 'networkCommandResponse') || 'networkCommand'), globTraceId, apiRequestId}});
                })
                .catch((error) => this.log('error', {in: 'externalIn', error}));
        }

        getInternalCommunicationContext(meta) {
            this.log('info', {in: 'getInternalCommunicationContext', meta});
            return super.getInternalCommunicationContext(meta, {
                connect: () => this.connect()
            });
        }

        externalOut({result, error, meta}) {
            this.log('info', {in: 'externalOut', result, error, meta});
            if (error) {
                return Promise.resolve({error})
                    .then(() => {
                        return this.socket.end(() => this.socket.destroy());
                    });
            }
            return this.encode(result)
                .then((buffer) => {
                    this.log('info', {in: 'externalOut', worldOutBuffer: buffer.toString('hex')});
                    return this.socket.write(buffer);
                })
                .catch((e) => {
                    return this.log('error', {in: 'externalOut', error: e});
                });
        }
    }

    return Net;
};
