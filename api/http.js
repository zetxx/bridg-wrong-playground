const Hapi = require('hapi');
const Inert = require('inert');
const Vision = require('vision');
const Boom = require('boom');
const Joi = require('joi');
const uuid = require('uuid/v4');
const HapiSwagger = require('hapi-swagger');
const pso = require('parse-strings-in-object');
const rc = require('rc');
const serializeError = require('serialize-error');

const swaggerOptions = {
    info: {
        title: 'Test API Documentation',
        version: '0.0.1'
    }
};

const validate = (log, {params = Joi.object().required(), method = 'dummy.method'} = {}) => {
    return {
        payload: Joi.object().keys({
            jsonrpc: Joi.any().valid('2.0').required(),
            id: Joi.number().example([1]),
            meta: Joi.object().required(),
            method: Joi.string().required().example([method]),
            params
        }).optionalKeys('id').required(),
        failAction: (request, h, err) => {
            if (err) {
                log('error', {in: 'http-api-fail-handler:method:failAction', error: err, payload: request.payload});
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
        }

        start() {
            return super.start()
                .then(() => (
                    this.setStore(
                        ['config', 'api'],
                        pso(rc(this.getNodeName() || 'buzzer', {
                            api: {
                                port: 8080,
                                address: '0.0.0.0'
                            }
                        }).api)
                    )
                ))
                .then(() => this.log('info', {in: 'start', message: `api-http pending: ${JSON.stringify(this.getStore(['config', 'api']))}`}))
                .then(() => (new Promise((resolve, reject) => {
                    const server = Hapi.server(this.getStore(['config', 'api']));
                    server.route({
                        method: '*',
                        path: '/JSONRPC/{method*}',
                        options: {
                            tags: ['api'],
                            handler: ({payload: {params, id = 0, method, meta: {globTraceId} = {}} = {}}, h) => {
                                const msg = {message: params, meta: {method, globTraceId: (globTraceId || uuid()), isNotification: (!id)}};
                                this.log('trace', {in: 'method:jsonrpc-api-handler.request.response', pack: msg, error: 'MethodNotFound'});
                                return {id: id, error: 'MethodNotFound'};
                            }
                        }
                    });
                    this.apiRoutes.map(({methodName, validate: {input}, cors, ...route}) => {
                        this.log('debug', {in: 'api.route.register', methodName});
                        return server.route(Object.assign({
                            method: 'POST',
                            path: `/JSONRPC/${methodName}`,
                            handler: ({payload: {params, id = 0, meta: {globTraceId, responseMatchKey} = {}} = {}}, h) => {
                                const msg = {message: params, meta: {method: methodName, responseMatchKey, globTraceId: (globTraceId || uuid()), isNotification: (!id)}};
                                this.log('trace', {in: 'method:jsonrpc-api-handler.request', pack: msg});
                                return this.apiRequestReceived(msg)
                                    .then((response = {id: id, error: new Error('unknown error')}) => {
                                        this.log('trace', {in: 'method:jsonrpc-api-handler.response', pack: msg, response});
                                        return response;
                                    })
                                    .catch((error) => {
                                        this.log('trace', {in: 'method:jsonrpc-api-handler.response', pack: msg, error});
                                        return {id: id, error: serializeError(error)};
                                    });
                            },
                            options: {
                                tags: ['api'],
                                cors,
                                validate: validate(this.log.bind(this), {params: input, method: methodName})
                            }
                        }, route));
                    });
                    server.events.on('start', resolve);
                    return server.register([
                        Inert,
                        Vision,
                        {
                            plugin: HapiSwagger,
                            options: swaggerOptions
                        }
                    ]).then(() => server.start());
                })))
                .then(() => this.log('info', {
                    in: 'start',
                    swaggerUrl: `http://${this.getStore(['config', 'api', 'address'])}:${this.getStore(['config', 'api', 'port'])}/documentation`,
                    message: `api-http ready: ${JSON.stringify(this.getStore(['config', 'api']))}`
                }))
                .then(() => (this.getStore(['config', 'api'])));
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
    }
    return ApiHttp;
};
