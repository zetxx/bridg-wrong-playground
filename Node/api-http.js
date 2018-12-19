const Node = require('bridg-wrong');
const Hapi = require('hapi');
const Inert = require('inert');
const Vision = require('vision');
const Boom = require('boom');
const Joi = require('joi');
const uuid = require('uuid/v4');
const HapiSwagger = require('hapi-swagger');
const swaggerOptions = {
    info: {
        title: 'Test API Documentation',
        version: require('../package').version
    }
};

const validate = {
    payload: Joi.object().keys({
        jsonrpc: Joi.any().valid('2.0').required(),
        id: Joi.number().example(1),
        meta: Joi.object().required(),
        method: Joi.string().required(),
        params: Joi.object().required()
    }).optionalKeys('id').required(),
    failAction: (request, h, err) => {
        if (err) {
            this.log('error', {in: 'http-api-fail-handler:method:failAction', error: err, payload: request.payload});
            throw Boom.badRequest('ValidationError');
        }
        throw err;
    }
};

class ApiHttp extends Node {
    constructor({httpApiPort = 80} = {}) {
        super();
        this.configApi = {
            httpServer: {
                port: httpApiPort,
                address: '0.0.0.0'
            }
        };
        this.apiRoutes = [];
    }

    start() {
        return super.start()
            .then(() => this.log('info', {in: 'start', message: `api-http pending: ${JSON.stringify(this.configApi.httpServer)}`}))
            .then(() => (new Promise((resolve, reject) => {
                const server = Hapi.server(this.configApi.httpServer);
                server.route({
                    method: '*',
                    path: '/JSONRPC/{method*}',
                    options: {
                        tags: ['api'],
                        handler: (request, h) => ({id: -1, error: 'MethodNotFound'})
                    }
                });
                this.apiRoutes.map(({methodName, ...route}) => server.route(Object.assign({
                    method: 'POST',
                    path: `/JSONRPC/${methodName}`,
                    handler: ({payload: {params, id = false, meta: {globTraceId = uuid()} = {}} = {}}, h) => {
                        const msg = {message: params, meta: {method: methodName, globTraceId, isNotification: (!id)}};
                        this.log('info', {in: 'jsonrpc-api-handler:method', pack: msg});
                        return this.apiRequestReceived(msg)
                            .then((response = 'empty') => ({response: response}))
                            .catch(() => ({error: true}));
                    },
                    options: {
                        tags: ['api'],
                        validate
                    }
                }, route)));
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
            .then(() => this.log('info', {in: 'start', message: `api-http ready: ${JSON.stringify(this.configApi.httpServer)}`}))
            .then(() => (this.configApi.httpServer));
    }

    registerApiMethod({method, direction, fn}) {
        direction === 'in' && this.apiRoutes.push({methodName: method});
        super.registerApiMethod({method: [method, direction].join('.'), fn});
    }

    externalOut({message, meta}) {
        return this.externalIn({message, meta});
    }
}

module.exports = ApiHttp;
