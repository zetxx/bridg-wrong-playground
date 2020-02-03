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
                setTimeout(() => this.triggerEvent('calling_a'), 500)
            }
            return await super.start();
        }
    }

    var service = new Service({id: [id, suf].join('')});
    service.registerApiMethods([{
        method: 'r',
        direction: 'in',
        fn: function(message = {}) {
            return {r: 1};
        }
    }, {
        method: 'n',
        direction: 'in',
        meta: {isNotification: 1},
        fn: function(message = {}) {
            return {n: 1};
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
        fn: function(message) {
            this.request(`${id}a.r`);
        }
    }]);

    service.start()
        .then(() => service.log('info', {in: 'ready', description: 'service ready', fingerprint: service.getFingerprint()}))
        .catch((e) => service.log('error', {in: 'ready', error: e}));
};
