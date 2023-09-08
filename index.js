const client = require('./implementations/http-client');
const server = require('./implementations/http-server');
const Router = require('bridg-wrong/lib/router');

const app = 'http.client.server';

(async() => {
    const c = client({
        app,
        part: 'client'
    });
    const s = server({
        app,
        part: 'server'
    });
    const router = Router({
        wires: [c, s]
    });

    await router.start();
})();
