const uuid = require('uuid/v4');
const {Map, fromJS} = require('immutable');

module.exports = (Node) => {
    var store = Map();
    var processUID = [uuid(), Date.now()].join(':');

    class State extends Node {
        setStore(keyPath, collections) {
            store = store.setIn(keyPath, fromJS(collections));
        }

        getStore(searchKeyPath, notSetValue) {
            var res = store.getIn(searchKeyPath, notSetValue);
            return (res && res.toJS && res.toJS()) || res;
        }
    }
    return class Service extends State {
        async triggerEvent(event, {message, meta} = {}) {
            if (this.stopping) {
                return;
            }
            this.log('trace', {in: 'service.triggerEvent', event, message});
            try {
                let fn = await this.findExternalMethod({method: `event.${event}`});
                let result = await fn(this.getInternalCommunicationContext({direction: 'in', ...meta}), message, meta);
                return result && this.externalOut({result, meta: {method: event, event: true}});
            } catch (error) {
                return this.log('error', {in: 'service.triggerEvent', error});
            }
        }
        getFingerprint() {
            return Object.assign(
                {},
                (super.getFingerprint && super.getFingerprint()) || {},
                {nodeName: this.getNodeId(), domain: this.domain, processUID}
            );
        }

        // construct global trace id
        getGlobTrace(meta) {
            var globTrace = {};
            if (!meta.globTrace) {
                globTrace.id = uuid();
                globTrace.count = 1;
            } else {
                return super.getGlobTrace(meta);
            }
            return super.getGlobTrace({globTrace});
        }

        // expose getInternalCommunicationContext because it is needed for request and notif.
        getInternalCommunicationContext(meta) {
            this.log('trace', {in: 'service.getInternalCommunicationContext', meta});
            return super.getInternalCommunicationContext(meta, {
                lib: this.lib || {},
                log: (...args) => this.log(...args)
            });
        }
        // expose request to main api
        request(destination, message, meta = {}) {
            return this.getInternalCommunicationContext(meta).request(destination, message, meta);
        }
        // expose notification to main api
        notification(destination, message, meta = {}) {
            return this.getInternalCommunicationContext(meta).notification(destination, message, meta);
        }
    };
};
