const pso = require('parse-strings-in-object');
const rc = require('rc');
const request = require('request-promise-native');
const codec = () => ({encode: (msg) => Promise.resolve(msg), decode: (msg) => Promise.resolve(msg)});

module.exports = (Node) => {
    class Http extends Node {
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
                            http: {}
                        }).http)
                    )
                ));
        }

        triggerEvent(event, message = {}) {
            this.log('info', {in: 'triggerEvent', event, message});
            return this.findExternalMethod({method: `event.${event}`})
                .then((fn) => fn(this.getInternalCommunicationContext({direction: 'in'}), message, {}))
                .then((result) => this.externalOut({result}, null, {}))
                .catch((error) => this.log('error', {in: 'method:triggerEvent', error}));
        }

        externalOut({result, error, meta}) {
            this.log('info', {in: 'externalOut', result, error, meta});
            return request(result);
        }
    }

    return Http;
};
