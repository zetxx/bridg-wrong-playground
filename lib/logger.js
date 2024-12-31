const {initMeta} = require('./helpers');
const p = require('pino');

const pinoLogger = (config = {}) => {
    pi = p(
        {
            name: config?.name || '?',
            level: config?.level || 'info'
        },
        p.transport({
            targets: [
                {
                    level: 'error',
                    target: 'pino-pretty',
                    options: {
                        levelFirst: true,
                        colorize: true
                    }
                }
            ]
        })
    );
    return pi;
};

const loggers = new Map();
const Logger = ({prev, config}) => {
    let ownLogger;
    class logger extends prev {
        constructor() {
            super();
            ownLogger = this.logger(['Logger']);
        }
        logger(createArgs) {
            const lid = createArgs.concat(this.namespace).join('.');
            if (!loggers.get(lid)) {
                loggers.set(
                    this.namespace,
                    pinoLogger({
                        ...config,
                        name: `${this.namespace}.${createArgs.join('.')}`
                    })
                );
            }
            return loggers.get(this.namespace);
        }
        log() {}
        add(arg) {
            const {name, fn} = arg;
            ownLogger.debug(`Adding ${name}`);
            super.add(arg);
        }
        remove(data) {
            ownLogger.debug('Remove', data.name);
            super.remove(data);
        }
        async send(data) {
            ownLogger.debug([
                'Send',
                {
                    id: data.id,
                    method: data.method,
                    caller: data?.meta?.caller,
                    ...data?.meta?.passTrough
                }
            ]);
            try {
                return await super.send(data);
            } catch (e) {
                ownLogger.error([
                    'Send',
                    e?.error?.stack || e?.stack || e,
                    data
                ]);
                throw e;
            }
        }
        async notify(...args) {
            try {
                return await super.notify(...args);
            } catch (e) {
                ownLogger.error([
                    'Notify',
                    e?.error?.stack || e?.stack || e,
                    args
                ]);
            }
        }
        async init() {
            ownLogger.info('Init');
            return super.init && (await super.init());
        }
        async stop() {
            ownLogger.warn('Stopping');
            loggers.clear();
            return super.stop && (await super.stop());
        }
    }

    return logger;
};

module.exports = Logger;
