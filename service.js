module.exports = (Node) => {
    return class Service extends Node {
        getFingerprint() {
            return Object.assign({}, super.getFingerprint(), {nodeName: this.name, domain: this.domain});
        }
    };
};
