const client = require('./implementations/http-client');
const server = require('./implementations/http-server');
const Router = require('bridg-wrong/lib/router');

const app = 'http.client.server';

(async() => {
    const v1 = client({
        app: app,
        part: 'client'
    });
    const v2 = server({
        app: app,
        part: 'server'
    });
    const router = Router({
        vectors: [v1, v2]
    });
    v1.ctx({router});
    v2.ctx({router});
    await v1.start();
    await v2.start();
})();