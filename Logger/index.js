const Service = require('../Node/discovery');
const logger = require('pino')({
    prettyPrint: {colorize: true}
});

class MainLogger extends Service {
    log(level, message) {
        logger[level || 'info'](Object.assign({pid: 'Logger'}, message));
        return Promise.resolve({});
    }
}

var service = new MainLogger({name: 'logger', httpApiPort: 9999});

service.registerApiMethod({
    method: 'log',
    direction: 'in',
    fn: function({level = 'info', fingerPrint, ...rest}) {
        try {
            service.log((level || 'info'), {pid: `${fingerPrint.nodeName}`, ...rest});
        } catch (e) {}
        return {};
    }
});
service.start();
