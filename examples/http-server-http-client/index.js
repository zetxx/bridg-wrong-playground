const app = 'http-server-http-client';
const client = require('../../implementations/http-client')({
    app
});
const server = require('../../implementations/http-server')({
    app
});

(async() => {
    client.intersect({other: server});
    server.intersect({other: client});
    await server.start();
    await client.start();
})();