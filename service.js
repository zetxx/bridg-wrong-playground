module.exports = (Node) => {
    return class Service extends Node {
        getFingerprint() {
            return Object.assign({}, (super.getFingerprint && super.getFingerprint()) || {}, {nodeName: this.name, domain: this.domain});
        }

        getInternalCommunicationContext(meta) {
            this.log('debug', {in: 'service.getInternalCommunicationContext', meta});
            return super.getInternalCommunicationContext(meta, {
                lib: this.lib || {},
                log: (...args) => this.log(...args)
            });
        }
    };
};
