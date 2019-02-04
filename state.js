const {Map, fromJS} = require('immutable');
const uuid = require('uuid/v4');

module.exports = (Node) => {
    class State extends Node {
        constructor() {
            super();
            this.store = Map();
            this.pUid = [uuid(), Date.now()].join(':');
        }

        setStore(keyPath, collections) {
            this.store = this.store.setIn(keyPath, fromJS(collections));
        }

        getStore(searchKeyPath, notSetValue) {
            var res = this.store.getIn(searchKeyPath, notSetValue);
            return (res && res.toJS && res.toJS()) || res;
        }
    }
    return State;
};
