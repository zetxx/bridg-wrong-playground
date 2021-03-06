const http = require('http');
const https = require('https');
const errors = require('./errors');

module.exports = ({remote, listen, timeout}, log, {cleanMeta}) => {
    var intCounter = 1;

    return {
        send: ({method, params, meta}) => (new Promise((resolve, reject) => {
            let metaClean = cleanMeta(meta);
            var body = JSON.stringify({
                jsonrpc: '2.0',
                method,
                meta: metaClean || {},
                params,
                id: (!metaClean || metaClean.isNotification) ? 0 : intCounter++
            });
            var resolved = false;
            let reqObj = {
                protocol: (remote.tunnel && 'https:') || 'http:',
                hostname: remote.host,
                port: remote.port,
                timeout,
                path: '/',
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'content-length': Buffer.from(body, 'utf8').length
                }
            };
            var req = ((remote.tunnel && https) || http)
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
                                throw new errors.Http(resp.statusCode);
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
                err.setState && err.setState({method, params, meta: metaClean});
                !resolved && reject(err);
                resolved = true;
            });
            req.write(body);
            req.end();
        })),
        destroy: () => {}
    };
};
