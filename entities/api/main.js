var Ajv = require('ajv');
const {constructJsonrpcRequest} = require('../../utils');
const errors = require('./errors');

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
    class Api extends Node {
        parseIncomingApiCall(requestData) {
            let id;
            this.log('trace', {in: 'api.http.callApiMethod', msg: requestData});
            let {method, ...json} = JSON.parse(requestData);
            id = json.id;
            let {validation} = this.apiRoutes.filter(({methodName}) => (methodName === method)).pop() || {};
            if (!validation) {
                throw new errors.MissingValidation(`missing validation for ${method}`, {id, state: {method, json}});
            }
            var ajv = new Ajv();
            let validate = ajv.compile(validation);
            let valid = validate({method, ...json});
            if (!valid) {
                this.log('error', {in: 'api.http.callApiMethod', error: validate.errors});
                throw new errors.Validation('Validation', {id, state: {errors: validate.errors, method, json}});
            }
            return {id, parsed: constructJsonrpcRequest({method, ...json}, (...args) => this.getGlobTrace(...args))};
        }
        async callApiMethod(requestData) {
            let r;
            let {id, parsed} = this.parseIncomingApiCall(requestData);
            try {
                r = {id, result: await this.apiRequestReceived(parsed)};
            } catch (e) {
                !e.id && (e.setId(id));
                throw e;
            }
            return r;
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
    }
    return Api;
};
