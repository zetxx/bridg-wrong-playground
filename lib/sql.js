const {join} = require('path');
const migration = require('migration-collection/lib/postgres');
const exposeMethods = require('expose-sql-methods/lib/postgres');

const Sql = ({
    prev,
    config,
    wires,
    list
}) => {
    class sql extends prev({wires, list}) {
        async init() {
            this.log('info', 'Sql', 'Init');
            await migration({
                ...config,
                cwd: (config?.cwd || []).map((p) => join(require.main.path, p))
            });
            this.exposed = await exposeMethods(config);
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
            await this.exposed.end();
            return super.stop && await super.stop();
        }
    }

    return sql;
};

module.exports = Sql;
