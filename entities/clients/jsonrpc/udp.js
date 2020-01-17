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

module.exports = ({remote, listen, responseTimeout}) => {
    var intCounter = 1;
    var client = dgram.createSocket('udp4');
    if (listen && listen.port) {
        client.on('message', (msg, rinfo) => {
            let {id, ...rest} = JSON.parse(msg.toString('utf8'));
            respondAndRemoveFromQueue(id, ({resolve, timeoutId}) => {
                clearTimeout(timeoutId);
                return resolve({id, ...rest});
            });
        });
        client.bind(listen.port);
    }
    var queue = [];
    const respondAndRemoveFromQueue = (id, cb) => {
        let idx = queue.findIndex(({qId}) => id === qId);
        cb(queue.slice(idx, 1).pop());
        queue = queue.slice(0, idx).concat(queue.slice(idx + 1));
    };
    var closed = false;

    return {
        send: ({method, params: {message, ...rest}, meta}) => (new Promise((resolve, reject) => {
            try {
                message && message.meta && message.meta.timeoutId && (message.meta.timeoutId = undefined);
                var preparedMessage = {
                    jsonrpc: '2.0',
                    method,
                    meta: meta || {},
                    params: {message, ...rest},
                    id: (!meta || meta.isNotification) ? 0 : intCounter++
                };
                var messageBuffer = Buffer.from(JSON.stringify(preparedMessage, getCircularReplacer()), 'utf8');
            } catch (e) {
                return reject(e);
            }
            try {
                !closed && client.send(messageBuffer, 0, messageBuffer.length, remote.port, remote.host, (err, bytes) => {
                    if (err) {
                        console.error(err, {remote, method, message, ...rest, meta});
                    } else {
                        if (preparedMessage.id) {
                            let qId = preparedMessage.id;

                            let timeoutId = setTimeout(() => {
                                respondAndRemoveFromQueue(qId, ({reject}) => {
                                    return reject(new Error('timeout'));
                                });
                                console.error(err, {remote, method, message, ...rest, meta});
                            }, responseTimeout); // todo timeout in config
                            queue.push({qId, resolve, reject, timeoutId});
                        } else {
                            resolve({});
                        }
                    }
                });
            } catch (e) {
                console.error(e);
            }
        })),
        destroy: () => {
            return !closed && client.close(() => (closed = true));
        }
    };
};
