const {Map, fromJS} = require('immutable');
const uuid = require('uuid/v4');

module.exports = (Node) => {
    class State extends Node {
        constructor() {
            super();
            this.state = Map();
            this.pUid = [uuid(), Date.now()].join(':');
        }

        setState(keyPath, collections) {
            this.state = this.state.setIn(keyPath, fromJS(collections));
        }

        getState(searchKeyPath, notSetValue) {
            var res = this.state.getIn(searchKeyPath, notSetValue);
            return (res && res.toJS && res.toJS()) || res;
        }
    }
    return State;
};
