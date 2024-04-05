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
            this.log('debug', 'Add', name);
            super.add({...arg, fn: async(data, ctx) => {
                if (!!data?.error) {
                    this.log('error', 'rpc exec', data.error);
                }
                return await fn(data, ctx);
            }});
        }
        remove(data) {
            this.log('debug', 'Remove', data.name);
            super.remove(data);
        }
        async send(data) {
            this.log('debug', 'Send', {
                id: data.id,
                method: data.method,
                caller: data?.meta?.caller,
                ...data?.meta?.passTrough
            });
            try {
                return await super.send(data);
            } catch (e) {
                this.log('error', 'Send', e, data);
                throw e;
            }
        }
        async init() {
            this.log('debug', 'Logger', 'Init');
            return super.init && (await super.init());
        }
        async stop() {
            this.log('debug', 'Logger', 'Stopping');
            loggers.clear();
            return super.stop && (await super.stop());
        }
    }

    return logger;
};

module.exports = Logger;
