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
                    destinations: [],
                    stdout: true
                }
            }).log)
        );
        this.logger = require('pino')({
            prettyPrint: {colorize: true},
            level: this.getStore(['config', 'log', 'level'])
        });
    }

    stop() {
        super.stop();
    }

    log(level, message) {
        var lvl = level || 'info';
        let stdout = this.getStore(['config', 'log', 'stdout']);
        const toBeLogged = Object.assign({pid: `${this.name}.${this.domain}`, logLevel: lvl, domain: this.domain, timestamp: Date.now(), date: new Date()}, message);
        stdout && this.logger[lvl](toBeLogged);
        return toBeLogged;
    }

    async start() {
        var service = this;
        service.registerApiMethod({
            method: 'log',
            direction: 'in',
            fn: function({level = 'info', fingerPrint, ...rest}) {
                let destinations = this.getState(['config', 'log', 'destinations']);
                destinations = ((destinations instanceof Array) && destinations) || (destinations && [destinations]);
                try {
                    let toBeLogged = service.log(level, {pid: `${fingerPrint.nodeName}`, ...rest});
                    destinations.map((destination) => this.notification(`${destination}.log`, toBeLogged));
                } catch (e) {}
                return false;
            }
        });

        return super.start();
    }
}

module.exports = Logger;
