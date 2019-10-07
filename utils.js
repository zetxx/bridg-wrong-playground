const rc = require('rc');
const pso = require('parse-strings-in-object');

// creates object based on path given and innerValue
// if path is ['a', 'b'] and innerValue is {c: {d: 'xaxa'}} it will produce {a: {b: {c: {d: 'xaxa'}}}}
const arr2obj = (arr, innerValue) => {
    return arr.slice(0).reverse().reduce((a, c) => {
        return (!a && {[c]: innerValue}) || {[c]: a};
    }, null);
};

module.exports = {
    getConfig: (name, path, innerValue) => {
        // tries to extract specific path from object generated from rc(name, arr2obj(path, def))
        let rcRes = path.reduce((rcTmp, c) => rcTmp[c], rc(name, arr2obj(path, innerValue)));
        return pso(rcRes);
    }
};
