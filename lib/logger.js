const {initMeta} = require('./helpers');

const pino = (() => {
    let pi;
    return (config = {}) => {
        if (pi) {
            return pi;
        }
        const p = require('pino');
        let pinoConf;
        if (!config?.transport) {
            pinoConf = {
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: true,
                        colorizeObjects: true
                    }
                }
            };
        }
        pi = p(pinoConf);
        return pi;
    };
})();

const loggers = new Map();
const Logger = ({
    prev,
    config
}) => {
    const clog = pino(config.pino);
    class logger extends prev {
        log(level, ...rest) {
            let l = loggers.get(this.namespace);
            if (!l) {
                l = clog.child(
                    {namespace: this.namespace},
                    {level: config?.level || 'trace'}
                );
                loggers.set(this.namespace, l);
            }
            l[level](rest);
        }
        add(arg) {
            const {name, fn} = arg;
            this.log('debug', 'Logger', 'Add', name);
            super.add(arg);
        }
        remove(data) {
            this.log('debug', 'Logger', 'Remove', data.name);
            super.remove(data);
        }
        async ask(data) {
            if (data.meta) {
                return super.ask(data);
            }
            return super.ask({
                ...data,
                meta: initMeta()
            });
        }
        async send(data) {
            this.log('debug', 'Logger', 'Send', {
                id: data.id,
                method: data.method,
                caller: data?.meta?.caller,
                ...data?.meta?.passTrough
            });
            try {
                return await super.send(data);
            } catch (e) {
                this.log(
                    'error',
                    'Send',
                    e?.error?.stack || e?.stack || e,
                    data
                );
                throw e;
            }
        }
        async notify(...args) {
            try {
                return await super.notify(...args);
            } catch (e) {
                this.log(
                    'error',
                    'Logger',
                    'Notify',
                    e?.error?.stack || e?.stack || e,
                    args
                );
            }
        }
        async init() {
            this.log('debug', 'Logger', 'Init');
            return super.init && (await super.init());
        }
        async stop() {
            this.log('warn', 'Logger', 'Stopping');
            loggers.clear();
            return super.stop && (await super.stop());
        }
    }

    return logger;
};

module.exports = Logger;
