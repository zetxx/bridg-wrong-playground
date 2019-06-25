const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert');
const Vision = require('@hapi/vision');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const uuid = require('uuid/v4');
const HapiSwagger = require('hapi-swagger');
const pso = require('parse-strings-in-object');
const rc = require('rc');
const serializeError = require('serialize-error');
const errors = require('bridg-wrong/lib/errors');

const swaggerOptions = {
    info: {
        title: 'Test API Documentation',
        version: '0.0.1'
    }
};

const validate = (log, {params = Joi.object().required(), isNotification = 0, method = 'dummy.method'} = {}) => {
    let payload = {
        jsonrpc: Joi.any().valid('2.0').required(),
        id: Joi.number().example([1]).required(),
        meta: Joi.object().required(),
        method: Joi.string().required().example([method]).required(),
        params
    };
    isNotification && (delete payload.id);

    return {
        payload: Joi.object().keys(payload).required(),
        failAction: (request, h, err) => {
            if (err) {
                log('error', {in: 'apiHttp.handler.error', error: err, payload: request.payload});
                throw Boom.badRequest('ValidationError');
            }
            throw err;
        }
    };
};

module.exports = (Node) => {
    class ApiHttp extends Node {
        constructor() {
            super();
            this.apiRoutes = [];
            this.httpApiServer;
        }

        async start() {
            await super.start();
            this.setStore(
                ['config', 'api'],
                pso(rc(this.getNodeName() || 'buzzer', {
                    api: {
                        port: 8080,
                        address: '0.0.0.0'
                    }
                }).api)
            );
            this.log('info', {in: 'apiHttp.start', message: `pending: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            const server = Hapi.server(this.getStore(['config', 'api']));
            server.route({
                method: 'GET',
                path: '/healthz',
                options: {
                    tags: ['api'],
                    handler: (req, h) => {
                        return {healthCheck: true};
                    }
                }
            });
            server.route({
                method: '*',
                path: '/JSONRPC/{method*}',
                options: {
                    tags: ['api'],
                    handler: ({payload: {params, id = 0, method, meta: {globTraceId} = {}} = {}}, h) => {
                        const msg = {message: params, meta: {method, globTraceId: (globTraceId || uuid()), isNotification: (!id)}};
                        this.log('error', {in: 'apiHttp.handler.request.response', pack: msg, error: 'MethodNotFound'});
                        return {id, error: serializeError(errors.methodNotFound(params))};
                    }
                }
            });
            this.apiRoutes.map(({methodName, validate: {input, isNotification}, cors, ...route}) => {
                this.log('debug', {in: 'apiHttp.route.register', methodName});
                return server.route(Object.assign({
                    method: 'POST',
                    path: `/JSONRPC/${methodName}`,
                    handler: async({payload: {params, id = 0, meta: {globTraceId, responseMatchKey} = {}} = {}}, h) => {
                        const msg = {message: params, meta: {method: methodName, responseMatchKey, globTraceId: (globTraceId || uuid()), isNotification: (!id)}};
                        this.log('trace', {in: 'apiHttp.handler.request', pack: msg});
                        try {
                            let response = {id, result: await this.apiRequestReceived(msg)};
                            this.log('trace', {in: 'apiHttp.handler.response', pack: msg, response});
                            return response;
                        } catch (error) {
                            this.log('error', {in: 'apiHttp.handler.response', pack: msg, error});
                            return {id, error: serializeError(error)};
                        }
                    },
                    options: {
                        tags: ['api'],
                        cors,
                        validate: validate(this.log.bind(this), {params: input, method: methodName, isNotification})
                    }
                }, route));
            });
            await server.register([Inert, Vision, {plugin: HapiSwagger, options: swaggerOptions}]);
            await server.start();
            this.httpApiServer = server;
            this.log('info', {
                in: 'apiHttp.start',
                swaggerUrl: `http://${this.getStore(['config', 'api', 'address'])}:${this.getStore(['config', 'api', 'port'])}/documentation`,
                message: `api-http ready: ${JSON.stringify(this.getStore(['config', 'api']))}`
            });
            return this.getStore(['config', 'api']);
        }

        registerApiMethod({method, direction = 'both', meta: {validate, cors} = {}, fn}) {
            (['in', 'both'].indexOf(direction) >= 0) && this.apiRoutes.push({methodName: method, validate: {[`input`]: validate}, cors});
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
            this.log('info', {in: 'apiHttp.stop', message: `stoping: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            await this.httpApiServer.stop();
            return super.stop();
        }
    }
    return ApiHttp;
};
