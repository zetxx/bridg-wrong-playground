module.exports = (Node) => {
    class Dummy extends Node {
        externalOut({result, error, meta}) {
            this.log('trace', {in: 'dummy.externalOut', result, meta, error});
            let newMeta = {...meta};
            if (meta && meta.event) {
                newMeta = {method: [meta.method, 'response'].join('.')};
            }
            return this.externalIn({result, meta: newMeta});
        }
    }

    return Dummy;
};
