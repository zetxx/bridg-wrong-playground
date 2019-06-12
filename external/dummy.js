module.exports = (Node) => {
    class Http extends Node {
        async triggerEvent(event, message = {}) {
            this.log('debug', {in: 'triggerEvent', event, message});
            try {
                let fn = await this.findExternalMethod({method: `event.${event}`});
                let result = await fn(this.getInternalCommunicationContext({direction: 'in'}), message, {});
                return result && this.externalOut({result, meta: {method: event, event: true}});
            } catch (error) {
                return this.log('error', {in: 'method:triggerEvent', error});
            }
        }

        externalOut({result, error, meta}) {
            this.log('debug', {in: 'externalOut', message: result, error, meta});
            let newMeta = {...meta};
            if (meta && meta.event) {
                newMeta = {method: [meta.method, 'response'].join('.')};
            }
            return this.externalIn({result, meta: newMeta});
        }

        getInternalCommunicationContext(meta) {
            this.log('debug', {in: 'getInternalCommunicationContext', meta});
            return super.getInternalCommunicationContext(meta, {
                lib: this.lib || {},
                log: (...args) => this.log(...args)
            });
        }
    }

    return Http;
};
