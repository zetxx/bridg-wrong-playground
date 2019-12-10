const extractFromPath = (path, from) => {
    let p = path.shift();
    if (p && from && from[p]) {
        if (path.length) {
            return extractFromPath(path, from[p]);
        } else {
            return from[p];
        }
    }
};

module.exports = ({getConfig}) => (Node) => {
    var nodeId = 'Node';
    var defConf;
    class First extends Node {
        constructor({
            id = 'Node', // used for config matching
            ...rest
        } = {}) {
            super(rest);
            nodeId = id;
        }

        getNodeId() {
            return nodeId;
        }

        getConfig(path, def) {
            var confSpec = {};
            if (!defConf) {
                defConf = getConfig(this.getNodeId(), [], {});
                // if there is node specific config (there is object in config with nodeId as key)
                if (defConf[nodeId]) {
                    confSpec = extractFromPath(path.concat([]), defConf[nodeId]) || {};
                }
            }
            let conf = getConfig(this.getNodeId(), path, def);
            return {...conf, ...confSpec};
        }
    }
    return First;
};
