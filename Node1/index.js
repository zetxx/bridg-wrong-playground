const Service = require('../Node/service');

var service = new Service({name: 'node1', httpApiPort: 7867});

service.registerApiMethod({
    method: 'a',
    direction: 'in',
    fn: function(message) {
        return this.request('node2.a', {some: 'params'})
            .then((r) => {
                return r;
            });
    }
});
service.registerApiMethod({
    method: 'a',
    direction: 'out',
    fn: function(message) {
        return message;
    }
});
service.registerExternalMethod({
    method: 'a',
    fn: function(message) {
        return message;
    }
});
service.start()
    .catch((e) => service.log('error', e));
