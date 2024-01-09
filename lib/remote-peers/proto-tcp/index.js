const server = require('./server');
const client = require('./client');

const RemotePeersProto = ({
    prev,
    config,
    wires,
    list
}) => {
    return server({
        prev: () => client({
            prev,
            config,
            wires,
            list
        }),
        config,
        wires,
        list
    });
};

module.exports = RemotePeersProto;
