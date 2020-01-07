const http = require('http');
const https = require('https');

module.exports = ({protocol = 'http:', hostname = 'localhost', port = 80}) => {
    var intCounter = 1;

    return {
        send: ({method, params, meta}) => (new Promise((resolve, reject) => {
            var body = JSON.stringify({
                jsonrpc: '2.0',
                method,
                meta: meta || {},
                params,
                id: (!meta || meta.isNotification) ? 0 : intCounter++
            });
            var resolved = false;
            let reqObj = {
                protocol,
                hostname,
                port,
                path: '/',
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'content-length': Buffer.from(body, 'utf8').length
                }
            };
            var req = ((protocol === 'https:' && https) || http)
                .request(reqObj, (resp) => {
                    var dataCollection = Buffer.from([]);
                    resp.on('data', (data) => {
                        dataCollection = Buffer.concat([dataCollection, data]);
                    });
                    resp.on('end', (data) => {
                        if (data) {
                            dataCollection = Buffer.concat([dataCollection, data]);
                        }
                        resolved = true;
                        try {
                            if (resp.statusCode !== 200) {
                                throw new Error(`Http:${resp.statusCode}`);
                            }
                            const rp = JSON.parse(dataCollection.toString());
                            if (rp.error) {
                                return reject(rp.error);
                            }
                            return resolve(rp.result);
                        } catch (e) {
                            return reject(e);
                        }
                    });
                });

            req.on('error', (err) => {
                err.httpClientError = true;
                err.requestData = JSON.stringify({method, params, meta});
                !resolved && reject(err);
                resolved = true;
            });
            req.write(body);
            req.end();
        })),
        destroy: () => {}
    };
};
