const Service = require('../Node/service');

var service = new Service({name: 'node2', httpApiPort: 7868});

service.registerApiMethod({
    method: 'a',
    direction: 'in',
    fn: function(message) {
        return message;
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
