const {serializeError} = require('serialize-error');
const {getConfig, factory} = require('../utils');
const discovery = getConfig('', ['resolve'], {}).type || 'mdns';
const Service = factory({state: true, api: {type: 'udp'}, discovery: {type: discovery}, service: true});

class Logger extends Service {
    constructor(args) {
        super(args);
        this.setStore(
            ['config', 'logger'],
            this.getConfig(['logger'], {
                level: 'trace',
                logOwn: false,
                destinations: [], // to were to send incoming requests
                stdout: true
            })
        );
        this.logger = require('pino')({
            prettyPrint: {colorize: true},
            level: this.getStore(['config', 'logger', 'level'])
        });
    }

    stop() {
        super.stop();
    }

    log(level, {logExternal, ...message}) {
        let logOwn = this.getStore(['config', 'logger', 'logOwn']);
        // log only if logExternal is true
        if (!logOwn && !logExternal) {
            return null;
        }
        var lvl = level || 'info';
        let stdout = this.getStore(['config', 'logger', 'stdout']);
        if (message.error) {
            message.error = serializeError(message.error);
        }
        const toBeLogged = Object.assign({pid: `${this.getNodeId()}.${this.domain}`, logLevel: lvl, domain: this.domain, timestamp: Date.now(), date: new Date()}, message);
        stdout && this.logger[lvl](toBeLogged);
        return toBeLogged;
    }

    async start() {
        var log = this.log.bind(this);

        this.registerApiMethod({
            method: 'log',
            direction: 'in',
            meta: {
                isNotification: 1
            },
            fn: function({level = 'info', fingerPrint, ...rest}) {
                let destinations = this.getState(['config', 'logger', 'destinations']);
                destinations = ((destinations instanceof Array) && destinations) || (destinations && [destinations]);
                try {
                    // set logExternal to true so everything that comes from wire will be logged
                    let toBeLogged = log(level, {pid: `${fingerPrint.nodeName}`, logExternal: true, ...rest});
                    destinations.map((destination) => this.notification(`${destination}.log`, toBeLogged));
                } catch (e) {}
                return false;
            }
        });

        return super.start();
    }
}

module.exports = Logger;
