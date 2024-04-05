const log4js = require('log4js');
log4js.configure({
    appenders: {
        console: { type: 'console' },
        defaultFile: {type: 'file', filename: '/tmp/logs/default.log'}
    },
    categories: {
        default: {
            appenders: ['console', 'defaultFile'],
            level: 'all'
        },
    }
});
const loggers = new Map();
const Logger = ({
    prev,
    config
}) => {
    class logger extends prev {
        log(level, ...rest) {
            let l = loggers.get(this.namespace);
            if (!l) {
                l = log4js.getLogger(this.namespace);
                loggers.set(this.namespace, l);
                l.level = config?.level || 'trace';
            }
            l[level](...rest);
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
            log4js?.shutdown();
            loggers.clear();
            return super.stop && (await super.stop());
        }
    }

    return logger;
};

module.exports = Logger;
