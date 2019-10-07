const net = require('net');
const {getConfig} = require('../utils');
const uuid = require('uuid/v4');
const codec = (config) => ({encode: (msg) => Promise.resolve(msg), decode: (msg) => Promise.resolve(msg)});

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
            var codecCofnig = getConfig(this.getNodeName() || 'buzzer', ['codec'], {
                macCheck: false
            });
            var c = (this.codec && this.codec(codecCofnig)) || codec(codecCofnig);
            this.encode = c.encode.bind(c);
            this.decode = c.decode.bind(c);
            this.receivedBuffer = Buffer.from('');
            this.connected = false;
            this.socket = undefined;
            this.lib = {...this.lib, connect: () => this.connect()};
            this.lib = {...this.lib, dissconnect: () => this.dissconnect()};
            let s = super.start();
            this.setStore(
                ['config', 'external'],
                getConfig(this.getNodeName() || 'buzzer', ['external'], {
                    type: 'tcp',
                    host: 'localhost', // to wich host to connect (where switch is listening)
                    port: 5000, // to wich port to connect  (where switch is listening)
                    responseTimeout: 10000 // throw timeout error after period of time (ms)
                })
            );
            setTimeout(() => !this.connected && this.triggerEvent('externalDisconnected'), 5000); // if only network gets restarted, send dissconect event if it is not connected
            return s;
        }
        connect() {
            this.log('debug', {in: 'tcp.connect', description: 'connection initialisation'});
            return new Promise((resolve, reject) => {
                if (!this.connected) {
                    this.socket = net.createConnection({port: this.getStore(['config', 'tcp', 'port']), host: this.getStore(['config', 'tcp', 'host'])});
                    this.socket.on('data', (data) => this.dataReceived(data));
                    this.socket.on('connect', () => {
                        this.log('debug', {in: 'tcp.connect', description: 'connected'});
                        this.connected = true;
                        this.socket.on('error', (e) => {
                            this.log('error', {in: 'tcp.connect.error', error: e});
                        });
                        this.log('info', {in: 'tcp.connect', description: 'network connected'});
                        resolve();
                    });
                    this.socket.on('error', (e) => {
                        this.log('error', {in: 'tcp.connect.error', error: e});
                    });
                    this.socket.on('close', (e) => {
                        this.connected = false;
                        this.socket = null;
                        this.log('warn', {in: 'tcp.connect', description: 'connectionClosed'});
                        this.triggerEvent('externalDisconnected');
                    });
                }
            });
        }

        dissconnect() {
            this.log('debug', {in: 'dissconnect', description: 'connection initialisation'});
            return new Promise((resolve, reject) => {
                return this.connected && this.socket.end();
            });
        }

        async stop() {
            return super.stop();
        }

        async triggerEvent(event, message = {}) {
            this.log('debug', {in: 'tcp.triggerEvent', description: event, args: {event, message}});
            try {
                let fn = this.findExternalMethod({method: `event.${event}`});
                return fn(this.getInternalCommunicationContext({direction: 'in'}), message, {});
            } catch (error) {
                this.log('error', {in: 'tcp.triggerEvent', error});
            }
        }

        getIncomingMessages(messages = []) {
            this.log('debug', {in: 'tcp.getIncomingMessages', args: {messages}});
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
                        this.log('debug', {in: 'tcp.dataReceived', args: {buffer: buffer.toString('hex')}});
                        return buffer;
                    })
                    .then((buffer) => this.externalIn({result: buffer})) // send parsed msg to terminal
                    .catch((e) => (this.log('error', {in: 'tcp.dataReceived', error: e})))
                );
        }

        matchExternalInToTx(result) {
            this.log('debug', {in: 'tcp.matchExternalInToTx', args: {result}});
            var idxRspMatch = this.apiRequestsPool.findIndex(({meta: {responseMatchKey} = {}} = {}) => {
                if (responseMatchKey && responseMatchKey.messageCoordinationNumber && result && result.messageCoordinationNumber) {
                    return result.messageCoordinationNumber === responseMatchKey.messageCoordinationNumber;
                }
                return false;
            });
            if (idxRspMatch >= 0) {
                var {apiRequestId, globTraceId} = this.apiRequestsPool[idxRspMatch].meta;
                return {apiRequestId, globTraceId};
            }
            return {};
        }

        async externalIn({result}) {
            this.log('trace', {in: 'tcp.externalIn', args: {result}});
            try {
                let {parsed} = await this.decode(result);
                this.log('debug', {in: 'tcp.externalIn', args: {parsed}});
                var {apiRequestId, globTraceId} = this.matchExternalInToTx(parsed);
                return super.externalIn({result: parsed, meta: {method: ((apiRequestId && 'networkCommandResponse') || 'networkCommand'), globTraceId: (globTraceId || {id: uuid(), count: 1}), apiRequestId}});
            } catch (error) {
                this.log('error', {in: 'tcp.externalIn', error});
            }
        }

        async externalOut({result, error, meta}) {
            this.log('trace', {in: 'tcp.externalOut', args: {result, meta}, error});
            if (error) {
                this.socket.end(() => this.socket.destroy());
                throw error;
            }
            try {
                let buffer = await this.encode(result);
                this.log('debug', {in: 'tcp.externalOut', args: {worldOutBuffer: buffer.toString('hex')}});
                return this.socket.write(buffer);
            } catch (error) {
                this.socket.end(() => this.socket.destroy());
                this.log('error', {in: 'tcp.externalOut.catch', error});
                throw error;
            }
        }
    }

    return Tcp;
};
