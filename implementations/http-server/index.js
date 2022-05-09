const http = require('http');
const Router = require('../log');

module.exports = ({app}) => {
    const router = Router({
        app,
        routerId: 'http-server'
    });

    const {
        config: {
            http: {server: config}
        }
    } = router;

    router.methods.add({
        method: 'method1.in',
        fn: ({payload, error}) => ((payload || [])
            .concat('method1.in'))
    });
    router.methods.add({
        method: 'method1.out',
        fn: ({payload, error}) => ((payload || [])
            .concat(['method1.out']))
    });

    const init = () => {
        const server = http.createServer(async(req, res) => {
            const inter = await router.pass({
                packet: {
                    payload: 3,
                    meta: {
                        method: 'method1',
                        direction: 'in'
                    }
                },
            });
            const result = await inter.promise;

            res.writeHead(200);
            res.end(JSON.stringify(result));
        });
        server.listen(config.listen.port);
        router.log('info', `http@ http://localhost:${config.listen.port}/`);
    };

    return {
        ...router,
        start: async() => {
            await router.start();
            init();
        }
    };
};