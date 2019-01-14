var dgram = require('dgram');

module.exports = ({hostname = 'localhost', port = 80}) => {
    var intCounter = 1;
    var client = dgram.createSocket('udp4');

    return ({method, params, meta}) => (new Promise((resolve, reject) => {
        var message = Buffer.from(JSON.stringify({
            jsonrpc: '2.0',
            method,
            meta: meta || {},
            params,
            id: (!meta || meta.isNotification) ? 0 : intCounter++
        }), 'utf8');
        client.send(message, 0, message.length, port, hostname, function(err, bytes) {
            err && console.error(err);
        });
    }));
};
