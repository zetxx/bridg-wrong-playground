const Node = require('../Node/logger');

class Service extends Node {
    getFingerprint() {
        return Object.assign({}, super.getFingerprint(), {nodeName: this.name, domain: this.domain});
    }
}

module.exports = Service;
