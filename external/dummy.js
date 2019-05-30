module.exports = (Node) => {
    class Http extends Node {
        triggerEvent(event, message = {}) {
            this.log('debug', {in: 'triggerEvent', event, message});
            return this.findExternalMethod({method: `event.${event}`})
                .then((fn) => {
                    return fn(this.getInternalCommunicationContext({direction: 'in'}), message, {});
                })
                .then((result) => {
                    return this.externalOut({result, meta: {method: event, event: true}});
                })
                .catch((error) => {
                    return this.log('error', {in: 'method:triggerEvent', error});
                });
        }

        externalOut({result, error, meta}) {
            this.log('debug', {in: 'externalOut', message: result, error, meta});
            let newMeta = {...meta};
            if (meta && meta.event) {
                newMeta = {method: [meta.method, 'response'].join('.')};
            }
            return this.externalIn({result, meta: newMeta});
        }
    }

    return Http;
};
