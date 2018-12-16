const Service = require('../Node/discovery');

var service = new Service({name: 'logger', httpApiPort: 9999});

service.registerApiMethod({
    method: 'log',
    direction: 'in',
    fn: function({level = 'log', ...rest}) {
        try {
            console[level](`logger: ${JSON.stringify(...rest)}`);
        } catch (e) {}
        return {};
    }
});
service.start();
