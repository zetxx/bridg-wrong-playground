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
        getFingerprint() {
            return Object.assign(
                {},
                (super.getFingerprint && super.getFingerprint()) || {},
                {nodeName: this.name, domain: this.domain, processUID}
            );
        }

        // construct global trace id
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

        // expose getInternalCommunicationContext because it is needed for request and notif.
        getInternalCommunicationContext(meta) {
            this.log('debug', {in: 'service.getInternalCommunicationContext', args: {meta}});
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
