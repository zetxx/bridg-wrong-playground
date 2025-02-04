const {join} = require('node:path');
const migration = require('migration-collection/lib/postgres');
const exposeMethods = require('expose-sql-methods/lib/postgres');

const Sql = ({
    prev,
    config
}) => {
    let ownLogger;
    class sql extends prev {
        constructor() {
            super();
            ownLogger = this.logger(['Sql']);
        }
        async init() {
            ownLogger.info('Init');
            await migration({
                ...config,
                cwd: (config?.cwd || []).map((p) => join(require.main.path, p))
            });
            this.exposed = await exposeMethods(
                config,
                {log: (level, ...a) => ownLogger[level](a)}
            );
            await Promise.all((config?.execOnBoot || []).map((name) => {
                if (!this.exposed.methods[name]) {
                    throw new Error('ExecOnBootMethodNotFound');
                }
                return this.exposed.methods[name]();
            }));
            await Promise.all(Object.keys(this.exposed.methods).map((method) => {
                const fn = this.exposed.methods[method];
                this.add({
                    name: [this.namespace, method].join('.'),
                    options: {exposable: true},
                    fn: async(message) => {
                        return (await fn(
                            message.params,
                            message.meta.transactionId
                        )).rows;
                    }
                });
            }));
            this.add({
                name: [this.namespace, 'txBegin'].join('.'),
                fn: async() => {
                    return await this.exposed.txBegin();
                }
            });
            this.add({
                name: [this.namespace, 'txEnd'].join('.'),
                fn: async(message) => {
                    return await this.exposed.txEnd(message.params.id, message.params.action);
                }
            });
            return super.init && await super.init();
        }
        async stop () {
            ownLogger.warn('Stopping');
            await this.exposed?.stop();
            return super.stop && await super.stop();
        }
    }

    return sql;
};

module.exports = Sql;
