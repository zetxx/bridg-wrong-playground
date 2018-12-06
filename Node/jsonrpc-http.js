const http = require('http');
const https = require('https');

module.exports = ({protocol = 'http:', hostname = 'localhost', port = 80}) => ({method, params}) => (new Promise((resolve, reject) => {
    var body = JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: 1
    });
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
        resp.on('data', (data) => resolve(data.toString()));
    });
    req.write(body);
    req.end();
}));
