const Node = require('bridg-wrong');
const Hapi = require('hapi');
const Inert = require('inert');
const Vision = require('vision');
const Boom = require('boom');
const Joi = require('joi');
const HapiSwagger = require('hapi-swagger');
const swaggerOptions = {
    info: {
        title: 'Test API Documentation',
        version: require('../package').version
    }
};

const validation = {
    payload: {
        jsonrpc: Joi.any().valid('2.0').required(),
        id: Joi.number().positive().example(1),
        meta: Joi.object().required(),
        method: Joi.string().required(),
        params: Joi.object().required()
    },
    failAction: (request, h, err) => {
        if (err) {
            console.error(err);
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
                    handler: (request, h) => {
                        return this.apiRequestReceived({message: {}, meta: {method: methodName}})
                            .then((response = 'empty') => ({response: response}))
                            .catch(() => ({error: true}));
                    },
                    options: {
                        tags: ['api'],
                        validate: validation
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
            .then(() => console.log('api-http ready', this.configApi.httpServer))
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
