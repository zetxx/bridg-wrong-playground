const p = require('pino');
let gl = undefined;

const pinoLogger = (config = {}) => {
    if (!gl) {
        const tr = {
            targets: [
                {
                    target: 'pino-pretty',
                    level: config?.level || 'trace',
                    options: {
                        singleLine: true,
                        levelFirst: true,
                        colorize: true
                    }
                },
                
            ]
        };
        if(config?.loki) {
            tr.targets.push({
                target: 'pino-loki',
                level: config?.level || 'trace',
                options: {
                    labels: {application: config?.application},
                    batching: true,
                    propsToLabels: ['service_name', 'method'],
                    interval: 5,
                    host: config?.loki?.host
                }
            });
        }
        gl = p(
            {
                name: config?.application || '?',
                level: config?.level || 'trace'
            },
            p.transport(tr)
        );
    }
    const child = gl.child(
        {service_name: config?.name},
        {level: config?.level || 'trace'}
    );
    return child; 
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
                'Send out',
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
                    'Send in',
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
