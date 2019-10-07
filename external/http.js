const {getConfig} = require('../utils');
const request = require('request-promise-native');
const codec = (config) => ({encode: (msg) => Promise.resolve(msg), decode: (msg) => Promise.resolve(msg)});

module.exports = (Node) => {
    class ExternalHttp extends Node {
        constructor({codec, ...rest}) {
            super(rest);
            this.codec = codec;
        }
        start() {
            var codecCofnig = getConfig(this.getNodeName() || 'buzzer', ['codec'], {});
            var c = (this.codec && this.codec(codecCofnig)) || codec(codecCofnig);
            this.encode = c.encode.bind(c);
            this.decode = c.decode.bind(c);
            return super.start()
                .then(() => (
                    this.setStore(
                        ['config', 'external'],
                        getConfig(this.getNodeName() || 'buzzer', ['external'], {
                            type: 'http',
                            timeout: 10000
                        })
                    )
                ));
        }

        async triggerEvent(event, message = {}) {
            this.log('trace', {in: 'externalHttp.triggerEvent', args: {event, message}});
            try {
                let fn = this.findExternalMethod({method: `event.${event}`});
                let result = await fn(this.getInternalCommunicationContext({direction: 'in'}), message, {});
                return this.externalOut({result, meta: {method: event, event: true}});
            } catch (error) {
                this.log('error', {in: 'externalHttp.triggerEvent', error});
            }
        }

        async externalOut({result, error, meta}) {
            this.log('trace', {in: 'externalHttp.externalOut', args: {meta, result}, error});
            let newMeta = {...meta};
            if (meta && meta.event) {
                newMeta = {method: [meta.method, 'response'].join('.')};
            }
            let timeout = this.getStore(['config', 'external', 'timeout']);
            try {
                let requestResult = await request({timeout, ...result});
                return this.externalIn({result: requestResult, meta: newMeta});
            } catch (error) {
                this.log('error', {in: 'externalHttp.externalOut.catch', meta: {...meta, reject: undefined, resolve: undefined, timeoutId: undefined}, error, requestArgs: result});
                return this.externalIn({error, meta: newMeta});
            }
        }
    }

    return ExternalHttp;
};
