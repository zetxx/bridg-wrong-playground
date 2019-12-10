module.exports = ({getConfig}) => (Node) => {
    var nodeId = 'Node';
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
    }
    return First;
};
