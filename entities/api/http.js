const http = require('http');
var Ajv = require('ajv');
// var conv = require('joi-to-json-schema');
const {getConfig, constructJsonrpcRequest} = require('../../utils');
const {serializeError} = require('serialize-error');

// https://npm.runkit.com/ajv
const validationGen = ({params = {}, isNotification = 0, method = 'dummy.method'} = {}) => {
    return {
        required: ['jsonrpc', 'method', 'params'],
        properties: {
            jsonrpc: {type: 'string', const: '2.0'},
            id: {type: 'integer', ...((isNotification && {maximum: 0}) || {minimum: 1})},
            meta: {type: 'object'},
            method: {type: 'string', const: method},
            params
        }
    };
};

module.exports = (Node) => {
    class ApiHttp extends Node {
        constructor(...args) {
            super(...args);
            this.apiRoutes = [];
            this.httpApiServer = null;
        }

        async start() {
            await super.start();
            this.setStore(
                ['config', 'api'],
                getConfig(this.getNodeId() || 'buzzer', ['api'], {
                    port: 8080,
                    address: '0.0.0.0'
                })
            );
            this.log('info', {in: 'api.http.start', description: `pending: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            return new Promise((resolve, reject) => {
                this.httpApiServer = http.createServer((req, res) => {
                    let {method, url} = req;
                    res.setHeader('Content-Type', 'application/json');
                    if (method === 'POST' && url === '/') {
                        var data = [];
                        req.on('data', (chunk) => data.push(chunk.toString('utf8')));
                        req.on('end', async() => {
                            try {
                                this.log('info', {in: 'api.http.method', method, url, request: data});
                                let ret = await this.callApiMethod(data.join(''));
                                res.writeHead(200);
                                res.end(JSON.stringify(ret));
                                this.log('info', {in: 'api.http.method', method, url, response: ret});
                            } catch (e) {
                                let {error, id} = e;
                                res.writeHead(500);
                                res.end(JSON.stringify({id, error: serializeError(error)}));
                            }
                        });
                    } else if (method === 'GET') {
                        if (url === '/healthz') {
                            this.log('trace', {in: 'api.http.request.healthz', method, url});
                            res.writeHead(200);
                            res.end('{"healthCheck": true}');
                        } else if (url === '/api') {
                            this.log('trace', {in: 'api.http.request.api', method, url});
                            res.writeHead(200);
                            res.end(JSON.stringify(this.apiRoutes.map(({methodName, validation}) => ({[methodName]: validation || null}))));
                        } else {
                            this.log('trace', {in: 'api.http.request.404', method, url});
                            res.writeHead(404);
                            res.end(null);
                        }
                    } else {
                        this.log('trace', {in: 'api.http.request.404', method, url});
                        res.writeHead(404);
                        res.end(null);
                    }
                });
                this.httpApiServer.listen({
                    host: this.getStore(['config', 'api', 'address']),
                    port: this.getStore(['config', 'api', 'port'])
                }, () => resolve(this.getStore(['config', 'api'])));
            });
        }

        async callApiMethod(requestData) {
            this.log('trace', {in: 'api.http.callApiMethod', msg: requestData});
            try {
                let {method, ...json} = JSON.parse(requestData);
                let {id} = json;
                let {validation} = this.apiRoutes.filter(({methodName}) => (methodName === method)).pop() || {};
                var ajv = new Ajv();
                let validate = ajv.compile(validation);
                let valid = validate({method, ...json});
                if (!valid) {
                    this.log('error', {in: 'api.http.callApiMethod', error: validate.errors});
                    throw Object.create({id, error: validate.errors});
                }
                let msg = constructJsonrpcRequest({method, ...json});
                return {id, result: await this.apiRequestReceived(msg)};
            } catch (e) {
                throw Object.create({id: undefined, error: e});
            }
        }
        registerApiMethod({method, direction = 'both', meta: {validation, cors, isNotification} = {}, fn}) {
            (['in', 'both'].indexOf(direction) >= 0) && this.apiRoutes.push({methodName: method, validation: validationGen({isNotification, method, params: validation || {}}), isNotification, cors});
            var directions = [];
            if (direction === 'both') {
                directions = ['in', 'out'];
            } else {
                directions = [direction];
            }
            directions.map((direction) => super.registerApiMethod({method: [method, direction].join('.'), fn}));
        }
        registerApiMethods(list = []) {
            list.map((item) => this.registerApiMethod(item));
        }

        registerExternalMethods(list = []) {
            list.map((item) => this.registerExternalMethod(item));
        }
        async stop() {
            this.log('info', {in: 'api.http.stop', description: `stopping: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            await this.httpApiServer.close({timeout: 2000});
            return super.stop();
        }
    }
    return ApiHttp;
};
