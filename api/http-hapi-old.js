const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert');
const Vision = require('@hapi/vision');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const HapiSwagger = require('hapi-swagger');
const {getConfig, constructJsonrpcRequest} = require('../utils');
const {serializeError} = require('serialize-error');
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
        id: (!isNotification && Joi.number().example([1]).required()) || Joi.any().valid(0).example([0]),
        meta: Joi.object().required(),
        method: Joi.string().required().example([method]).required(),
        params
    };

    return {
        payload: Joi.object().keys(payload).required(),
        failAction: (request, h, err) => {
            if (err) {
                log('error', {in: 'api.http.handler.error', error: err, payload: request.payload});
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
            this.httpApiServer = null;
        }

        async start() {
            await super.start();
            this.setStore(
                ['config', 'api'],
                getConfig(this.getNodeName() || 'buzzer', ['api'], {
                    port: 8080,
                    address: '0.0.0.0'
                })
            );
            this.log('info', {in: 'api.http.start', description: `pending: ${JSON.stringify(this.getStore(['config', 'api']))}`});
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
                    handler: ({payload}, h) => {
                        let msg = constructJsonrpcRequest(payload);
                        let {id} = payload;
                        this.log('error', {in: 'api.http.handler.request.response', args: msg, error: 'MethodNotFound'});
                        return {id, error: serializeError(errors.methodNotFound(msg))};
                    }
                }
            });
            this.apiRoutes.map(({methodName, validate: {input, isNotification}, cors, ...route}) => {
                this.log('debug', {in: 'api.http.route.register', description: `registering method ${methodName}`});
                return server.route(Object.assign({
                    method: 'POST',
                    path: `/JSONRPC/${methodName}`,
                    handler: async({payload}, h) => {
                        let {id} = payload;
                        let msg = constructJsonrpcRequest(payload);
                        this.log('trace', {in: 'api.http.handler.request', args: msg});
                        try {
                            let response = {id, result: await this.apiRequestReceived(msg)};
                            this.log('trace', {in: 'api.http.handler.response', args: msg, response});
                            return response;
                        } catch (error) {
                            this.log('error', {in: 'api.http.handler.response', args: msg, error});
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
            try {
                await server.register([Inert, Vision, {plugin: HapiSwagger, options: swaggerOptions}]);
                await server.start();
            } catch (e) {
                throw e;
            }
            this.httpApiServer = server;
            this.log('info', {
                in: 'api.http.start',
                description: `api.http ready: ${JSON.stringify(this.getStore(['config', 'api']))} swagger: http://${this.getStore(['config', 'api', 'address'])}:${this.getStore(['config', 'api', 'port'])}/documentation`
            });
            return this.getStore(['config', 'api']);
        }

        registerApiMethod({method, direction = 'both', meta: {validate, cors, isNotification} = {}, fn}) {
            (['in', 'both'].indexOf(direction) >= 0) && this.apiRoutes.push({methodName: method, validate: {[`input`]: validate, isNotification}, cors});
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
            this.log('info', {in: 'api.http.stop', description: `stoping: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            await this.httpApiServer.stop({timeout: 2000});
            return super.stop();
        }
    }
    return ApiHttp;
};
