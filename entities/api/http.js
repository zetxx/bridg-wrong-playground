const http = require('http');
const {serializeError} = require('serialize-error');
const Api = require('./main');

module.exports = (Node) => {
    class ApiHttp extends Api(Node) {
        constructor(...args) {
            super(...args);
            this.apiRoutes = [];
            this.httpApiServer = null;
        }

        async start() {
            await super.start();
            this.setStore(
                ['config', 'api'],
                this.getConfig(['api'], {
                    port: 8080, // listen port
                    address: '0.0.0.0' // listen address
                })
            );
            this.log('info', {in: 'api.http.start', description: `pending: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            return new Promise((resolve, reject) => {
                this.httpApiServer = http.createServer((req, res) => {
                    let {method, url} = req;
                    res.setHeader('Content-Type', 'application/json');
                    if (method === 'POST' && url === '/') {
                        var data = [];
                        req.on('data', (chunk) => data.push(chunk.toString('utf8')));
                        req.on('end', async() => {
                            try {
                                this.log('info', {in: 'api.http.method', method, url, request: data});
                                let ret = await this.callApiMethod(data.join(''));
                                res.writeHead(200);
                                res.end(JSON.stringify(ret));
                                this.log('info', {in: 'api.http.method', method, url, response: ret});
                            } catch (error) {
                                let {id} = error;
                                res.writeHead(500);
                                res.end(JSON.stringify({id, error: serializeError(error)}));
                            }
                        });
                    } else if (method === 'GET') {
                        if (url === '/healthz') {
                            this.log('trace', {in: 'api.http.request.healthz', method, url});
                            res.writeHead(200);
                            res.end('{"healthCheck": true}');
                        } else if (url === '/api') {
                            this.log('trace', {in: 'api.http.request.api', method, url});
                            res.writeHead(200);
                            res.end(JSON.stringify(this.apiRoutes.map(({methodName, validation}) => ({[methodName]: validation || null}))));
                        } else {
                            this.log('trace', {in: 'api.http.request.404', method, url});
                            res.writeHead(404);
                            res.end(null);
                        }
                    } else {
                        this.log('trace', {in: 'api.http.request.404', method, url});
                        res.writeHead(404);
                        res.end(null);
                    }
                });
                this.httpApiServer.listen({
                    host: this.getStore(['config', 'api', 'address']),
                    port: this.getStore(['config', 'api', 'port'])
                }, () => resolve(this.getStore(['config', 'api'])));
            });
        }

        async stop() {
            this.log('info', {in: 'api.http.stop', description: `stopping: ${JSON.stringify(this.getStore(['config', 'api']))}`});
            await this.httpApiServer.close({timeout: 2000});
            return super.stop();
        }
    }
    return ApiHttp;
};
