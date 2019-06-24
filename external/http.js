const pso = require('parse-strings-in-object');
const rc = require('rc');
const request = require('request-promise-native');
const codec = () => ({encode: (msg) => Promise.resolve(msg), decode: (msg) => Promise.resolve(msg)});

module.exports = (Node) => {
    class ExternalHttp extends Node {
        constructor({codec, ...rest}) {
            super(rest);
            this.codec = codec;
        }
        start() {
            var codecCofnig = rc(this.getNodeName() || 'buzzer', {
                codec: {}
            }).codec;
            var c = (this.codec && this.codec(codecCofnig)) || codec({});
            this.encode = c.encode.bind(c);
            this.decode = c.decode.bind(c);
            return super.start()
                .then(() => (
                    this.setStore(
                        ['config', 'http'],
                        pso(rc(this.getNodeName() || 'buzzer', {
                            http: {
                                timeout: 10000
                            }
                        }).http)
                    )
                ));
        }

        triggerEvent(event, message = {}) {
            this.log('debug', {in: 'externalHttp.triggerEvent', event, message});
            return this.findExternalMethod({method: `event.${event}`})
                .then((fn) => fn(this.getInternalCommunicationContext({direction: 'in'}), message, {}))
                .then((result) => this.externalOut({result, meta: {method: event, event: true}}))
                .catch((error) => this.log('error', {in: 'externalHttp.triggerEvent', error}));
        }

        externalOut({result, error, meta}) {
            this.log('debug', {in: 'externalHttp.externalOut', message: result, error, meta});
            let newMeta = {...meta};
            if (meta && meta.event) {
                newMeta = {method: [meta.method, 'response'].join('.')};
            }
            let timeout = this.getStore(['config', 'http', 'timeout']);
            return request({timeout, ...result})
                .then((requestResult) => {
                    return this.externalIn({result: requestResult, meta: newMeta});
                })
                .catch((error) => {
                    this.log('error', {in: 'externalHttp.externalIn', meta: {...meta, reject: undefined, resolve: undefined, timeoutId: undefined}, error, requestArgs: result});
                    return this.externalIn({error, meta: newMeta});
                });
        }
    }

    return ExternalHttp;
};
