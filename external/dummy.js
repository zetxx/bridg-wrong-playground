module.exports = (Node) => {
    class Dummy extends Node {
        async triggerEvent(event, message = {}) {
            this.log('trace', {in: 'dummy.triggerEvent', args: {event, message}});
            try {
                let fn = await this.findExternalMethod({method: `event.${event}`});
                let result = await fn(this.getInternalCommunicationContext({direction: 'in'}), message, {});
                return result && this.externalOut({result, meta: {method: event, event: true}});
            } catch (error) {
                return this.log('error', {in: 'dummy.triggerEvent', error});
            }
        }

        externalOut({result, error, meta}) {
            this.log('trace', {in: 'dummy.externalOut', args: {result, meta}, error});
            let newMeta = {...meta};
            if (meta && meta.event) {
                newMeta = {method: [meta.method, 'response'].join('.')};
            }
            return this.externalIn({result, meta: newMeta});
        }
    }

    return Dummy;
};
