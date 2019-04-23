const pso = require('parse-strings-in-object');
const rc = require('rc');
const {Pool} = require('pg');

// !!!! WARNING, SQL INJECTIONS POSSIBLE

module.exports = (Node) => {
    class Http extends Node {
        constructor(args) {
            super(args);
            this.setStore(
                ['config', 'storage'],
                pso(rc(this.getNodeName() || 'buzzer', {
                    storage: {
                        level: 'trace',
                        host: '0.0.0.0',
                        max: 6,
                        idleTimeoutMillis: 30000,
                        connectionTimeoutMillis: 2000,
                        user: 'some.user',
                        password: 'some.password',
                        database: 'some.database',
                        schema: 'some.schema'
                    }
                }).storage)
            );
            this.pool = new Pool(this.getStore(['config', 'storage']));
        }

        async start() {
            try {
                let client = await this.pool.connect();
                await client.query('SELECT NOW()');
                client.release();
                this.log('info', {connect: 'succesfull'});
                return super.start();
            } catch (e) {
                this.log('error', {connect: 'failed', error: e});
                throw e;
            }
        }

        async externalOut({result: {table, insert, select}, error, meta}) {
            let {schema, database} = this.getStore(['config', 'storage']);
            this.log('trace', {in: 'externalOut', message: {table, insert, select}, meta: {...meta, reject: undefined, resolve: undefined, timeoutId: undefined}});
            var query;
            if (insert) {
                let fullTableName = [database, schema, table].join('.');
                let fields = Object.keys(insert);
                let values = fields.map((field) => insert[field]).join(', ');
                query = `INSERT INTO ${fullTableName} (${fields.join(', ')}) VALUES (${values})`;
            }
            let client = await this.pool.connect();
            try {
                let {rows} = (await client.query(query)) || {};
                this.log('trace', {in: 'externalOut', result: {rows}, meta: {...meta, reject: undefined, resolve: undefined, timeoutId: undefined}});
                return this.externalIn({result: rows, meta});
            } catch (e) {
                this.log('error', {in: 'externalOut', error: e, meta: {...meta, reject: undefined, resolve: undefined, timeoutId: undefined}});
                return this.externalIn({error: e, meta});
            } finally {
                client.release();
            }
        }
    }

    return Http;
};
