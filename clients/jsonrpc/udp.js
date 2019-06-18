var dgram = require('dgram');
const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return;
            }
            seen.add(value);
        }
        return value;
    };
};

module.exports = ({hostname = 'localhost', port = 80}) => {
    var intCounter = 1;
    var client = dgram.createSocket('udp4');

    return ({method, params: {message, ...rest}, meta}) => (new Promise((resolve, reject) => {
        try {
            message && message.meta && message.meta.timeoutId && (message.meta.timeoutId = undefined);
            var messageBuffer = Buffer.from(JSON.stringify({
                jsonrpc: '2.0',
                method,
                meta: meta || {},
                params: {message, ...rest},
                id: (!meta || meta.isNotification) ? 0 : intCounter++
            }, getCircularReplacer()), 'utf8');
        } catch (e) {
            return reject(e);
        }
        client.send(messageBuffer, 0, messageBuffer.length, port, hostname, function(err, bytes) {
            err && console.error(err, {hostname, port, method, message, ...rest, meta});
        });
    }));
};
