const Service = require('../Node/discovery');

var service = new Service({name: 'node1', httpApiPort: 7867});

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
        return this.request('node2.a', {some: 'params'});
    }
});
service.start();
