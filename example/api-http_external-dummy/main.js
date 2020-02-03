const {getConfig, factory, throwOrReturn} = require('../../utils');

module.exports = (suf, eventSource = 0) => {
    const id = `api-http_external-dummy_`;
    class Service extends factory({
        state: true,
        api: {type: 'http'},
        discovery: {type: 'mdns'},
        log: {type: 'raw'},
        service: true,
        external: {type: 'dummy'},
        tracers: {type: 'opentracing-jaeger'}
    }) {
        async start() {
            if  (eventSource) {
                let interval = setInterval(() => {
                    if (this.stopping) {
                        clearInterval(interval);
                        return;
                    }
                    this.triggerEvent('calling_a');
                }, 1000)
            }
            return await super.start();
        }
    }

    var service = new Service({id: [id, suf].join('')});
    service.registerApiMethods([{
        method: 'r',
        direction: 'in',
        fn: async function(message = {}) {
            let result = {r: 1, node: [id, suf]};
            if (suf === 'a') {
                result[suf] = await this.request([id, 'c.r'].join(''), );
            }
            if (suf === 'c') {
                result[suf] = await this.request([id, 'b.r'].join(''), );
            }
            if (suf === 'b') {
                result[suf] = await this.request([id, 'd.r'].join(''), );
            }
            return result;
        }
    }, {
        method: 'r',
        direction: 'out',
        fn: function({result} = {}) {
            return result;
        }
    }, {
        method: 'n',
        direction: 'in',
        meta: {isNotification: 1},
        fn: function(message = {}) {
            return {n: 1, node: [id, suf]};
        }
    }, {
        method: 'n',
        direction: 'out',
        meta: {isNotification: 1},
        fn: function(message = {}) {
            return {n: 1, node: [id, suf]};
        }
    }]);
    service.registerExternalMethods([{
        method: 'r',
        fn: throwOrReturn
    }, {
        method: 'n',
        fn: throwOrReturn
    }, {
        method: 'event.calling_a',
        fn: async function(message) {
            await this.request(`${id}a.r`);
        }
    }]);

    service.start()
        .then(() => service.log('info', {in: 'ready', description: 'service ready', fingerprint: service.getFingerprint()}))
        .catch((e) => service.log('error', {in: 'ready', error: e}));
};
