const rc = require('rc');
const pso = require('parse-strings-in-object');
const Factory = require('bridg-wrong-playground/factory.js');
const discovery = (pso(rc('', {})).discovery === false && 'direct') || 'mdns';
const Service = Factory({state: true, api: {type: 'udp'}, discovery: {type: discovery}, service: true});

class Logger extends Service {
    constructor(args) {
        super(args);
        this.setStore(
            ['config', 'log'],
            pso(rc(this.getNodeName() || 'buzzer', {
                log: {
                    level: 'trace',
                    destinations: []
                }
            }).log)
        );
        this.logger = require('pino')({
            prettyPrint: {colorize: true},
            level: this.getStore(['config', 'log', 'level'])
        });
    }

    log(level, message) {
        var lvl = level || 'info';
        const toBeLogged = Object.assign({pid: `${this.name}.${this.domain}`, logLevel: lvl, domain: this.domain, timestamp: Date.now(), date: new Date()}, message);
        this.logger[lvl](toBeLogged);
        return toBeLogged;
    }
}

module.exports = (name) => {
    var service = new Logger({name: name || 'logger'});

    service.registerApiMethod({
        method: 'log',
        direction: 'in',
        fn: function({level = 'info', fingerPrint, ...rest}) {
            try {
                let toBeLogged = this.sharedContext.log(level, {pid: `${fingerPrint.nodeName}`, ...rest});
                this.getState(['config', 'log', 'destinations']).map((destination) => this.notification(`${destination}.log`, toBeLogged));
            } catch (e) {}
            return false;
        }
    });
    service.start()
        .catch((e) => service.log('error', {in: 'terminal.ready', error: e}));
};
