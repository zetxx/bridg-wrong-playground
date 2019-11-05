const {request} = require('http');
const {getConfig} = require('../utils');
const codec = (config) => ({encode: (msg) => Promise.resolve(msg), decode: (msg) => Promise.resolve(msg)});

module.exports = (Node) => {
    class ExternalHttp extends Node {
        constructor({codec, ...rest}) {
            super(rest);
            this.codec = codec;
        }
        start() {
            var codecConfig = getConfig(this.getNodeName() || 'buzzer', ['codec'], {});
            var c = (this.codec && this.codec(codecConfig)) || codec(codecConfig);
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
                this.log('error', {in: 'externalHttp.triggerEvent', args: {error}});
            }
        }

        async externalOut({result, error, meta}) {
            this.log('trace', {in: 'externalHttp.externalOut', args: {meta, result, error}});
            let newMeta = {...meta};
            if (meta && meta.event) {
                newMeta = {method: [meta.method, 'response'].join('.')};
            }
            let timeout = this.getStore(['config', 'external', 'timeout']);
            try {
                let {url, json, ...options} = result;
                return new Promise((resolve, reject) => {
                    let cb = (s) => {
                        var data = [];
                        s.on('data', (d) => data.push(d.toString('utf8')));
                        s.on('end', (d) => {
                            data = data.join('');
                            if (json) {
                                try {
                                    data = JSON.parse(data);
                                } catch (e) {
                                    return this.externalIn({error: e, meta: newMeta});
                                }
                            }
                            return this.externalIn({result: data, meta: newMeta});
                        });
                    };
                    ((url && request(url, {timeout, ...options}, cb)) || request({timeout, ...options}, cb)).end();
                });
            } catch (error) {
                this.log('error', {in: 'externalHttp.externalOut.catch', args: {meta: {...meta, reject: undefined, resolve: undefined, timeoutId: undefined}, result, error}});
                return this.externalIn({error, meta: newMeta});
            }
        }
    }

    return ExternalHttp;
};
