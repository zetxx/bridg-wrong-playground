const Service = require('../Node/discovery');

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
        return {rr: 123};
    }
});
service.start();
