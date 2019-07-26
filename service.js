const uuid = require('uuid/v4');

module.exports = (Node) => {
    return class Service extends Node {
        getFingerprint() {
            return Object.assign({}, (super.getFingerprint && super.getFingerprint()) || {}, {nodeName: this.name, domain: this.domain});
        }

        getGlobTraceId(meta) {
            var globTraceId = {};
            if (!meta.globTraceId) {
                globTraceId.id = uuid();
                globTraceId.count = 0;
            } else {
                return super.getGlobTraceId(meta);
            }
            return super.getGlobTraceId({globTraceId});
        }

        getInternalCommunicationContext(meta) {
            this.log('debug', {in: 'service.getInternalCommunicationContext', args: {meta}});
            return super.getInternalCommunicationContext(meta, {
                lib: this.lib || {},
                log: (...args) => this.log(...args)
            });
        }
        request(destination, message) {
            return this.getInternalCommunicationContext({}).request(destination, message);
        }
        notification(destination, message) {
            return this.getInternalCommunicationContext({}).notification(destination, message);
        }
    };
};
