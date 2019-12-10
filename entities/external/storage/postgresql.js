const {getConfig} = require('../../utils');
const {Pool} = require('pg');

// !!!! WARNING, SQL INJECTIONS POSSIBLE

module.exports = (Node) => {
    class Postgre extends Node {
        constructor(...args) {
            super(...args);
            this.setStore(
                ['config', 'external'],
                getConfig(this.getNodeId(), ['external'], {
                    level: 'trace',
                    host: '0.0.0.0',
                    max: 6,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 2000,
                    user: 'some.user',
                    password: 'some.password',
                    database: 'some.database',
                    schema: 'some.schema'
                })
            );
            this.pool = new Pool(this.getStore(['config', 'external']));
        }

        async start() {
            try {
                let client = await this.pool.connect();
                await client.query('SELECT NOW()');
                client.release();
                this.log('info', {in: 'postgre.start', connect: 'successfully'});
                return super.start();
            } catch (e) {
                this.log('error', {in: 'postgre.start', connect: 'failed', error: e});
                throw e;
            }
        }

        async stop() {
            this.pool.end(() => this.log('info', {in: 'postgre.stop', description: 'pool ended'}));
            return super.stop();
        }

        async externalOut({result: {table, insert, select, fn}, error, meta}) {
            let {schema, database} = this.getStore(['config', 'external']);
            this.log('info', {in: 'postgre.externalOut', message: {table, insert, select}, meta: {...meta, reject: undefined, resolve: undefined, timeoutId: undefined}});
            var query;
            let fullObjectName = [database, schema, table || (fn && fn.name)].join('.');
            let fields = Object.keys(insert || select || {});
            if (insert) {
                let values = fields.map((field) => insert[field]).join(', ');
                query = `INSERT INTO ${fullObjectName} (${fields.join(', ')}) VALUES (${values})`;
            } else if (select) {
                query = `SELECT * FROM ${fullObjectName} WHERE ${fields.map((field) => [field, select[field]].join('=')).join(' AND ')}`;
            } else if (fn) {
                query = {
                    text: `SELECT * FROM ${fullObjectName}(${fn.data.map((v, k) => `$${k + 1}`).join(', ')})`,
                    values: fn.data.map(({value}) => value)
                };
            }
            let client = await this.pool.connect();
            try {
                let res = (await client.query(query)) || {};
                this.log('info', {in: 'postgre.externalOut', result: res.rows, meta: {...meta, reject: undefined, resolve: undefined, timeoutId: undefined}});
                return this.externalIn({result: res.rows, meta});
            } catch (e) {
                this.log('error', {in: 'postgre.externalOut', error: e, meta: {...meta, reject: undefined, resolve: undefined, timeoutId: undefined}});
                return this.externalIn({error: e, meta});
            } finally {
                client.release();
            }
        }
    }

    return Postgre;
};
