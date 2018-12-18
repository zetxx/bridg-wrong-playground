const http = require('http');
const https = require('https');

module.exports = ({protocol = 'http:', hostname = 'localhost', port = 80}) => {
    var intCounter = 1;

    return ({method, params, meta}) => (new Promise((resolve, reject) => {
        var body = JSON.stringify({
            jsonrpc: '2.0',
            method,
            meta: meta || {},
            params,
            id: (!meta || meta.isNotification) ? 0 : intCounter++
        });
        var resolved = false;
        var req = ((protocol === 'https:' && https) || http).request({
            protocol,
            hostname,
            port,
            path: `/JSONRPC/${method}`,
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'content-length': body.length
            }
        }, (resp) => {
            resp.on('data', (data) => {
                resolved = true;
                return resolve(data.toString());
            });
        });
        req.on('error', (err) => {
            !resolved && reject(err);
            resolved = true;
        });
        req.write(body);
        req.end();
    }));
};
