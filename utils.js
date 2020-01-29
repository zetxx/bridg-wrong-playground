const rc = require('rc');
const uuid = require('uuid').v4;
const pso = require('parse-strings-in-object');
const bw = require('bridg-wrong');
const First = require('./entities/first');
const Last = require('./entities/last');

const execOrder = [
    'api', 'discovery', 'log', 'service', 'external', 'tracers'
];

// creates object based on path given and innerValue
// if path is ['a', 'b'] and innerValue is {c: {d: 'foo'}} it will produce {a: {b: {c: {d: 'foo'}}}}
const arr2obj = (arr, innerValue) => {
    return arr.slice(0).reverse().reduce((a, c) => {
        return (!a && {[c]: innerValue}) || {[c]: a};
    }, null);
};

module.exports = {
    throwOrReturn: function({result, error} = {}) {
        if (error) {
            throw error;
        }
        return result;
    },
    getConfig: (name, path, innerValue) => {
        // tries to extract specific path from object generated from rc(name, arr2obj(path, def))
        let rcRes = path.reduce((rcTmp, c) => rcTmp[c], rc(name, arr2obj(path, innerValue)));
        return pso(rcRes);
    },
    constructJsonrpcRequest: ({params, method, id = 0, meta: {globTraceId, responseMatchKey} = {}} = {}) => {
        return {
            message: params,
            meta: {
                method,
                responseMatchKey,
                globTraceId: (globTraceId || {id: uuid(), count: 1}),
                isNotification: (!id)
            }
        };
    },
    factory: (buildList) => {
        let producedNode = execOrder.reduce((prev, curr) => {
            if (buildList[curr]) {
                var req = [curr];
                buildList[curr].type && req.push(buildList[curr].type);
                return require(`./entities/${req.join('/')}`)(prev);
            }
            return prev;
        }, First(module.exports)(bw));

        return Last(producedNode);
    }
};
