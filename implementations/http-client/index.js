const http = require('http');
const Router = require('../log');

module.exports = ({app}) => {
    const directionHooks = {
        out: async(packet) => {
            packet.payload = packet.payload.concat('hook');
            console.log(123);
            return packet;
        }
    };

    const router = Router({
        app,
        directionHooks,
        routerId: 'http-client'
    });

    const {
        config: {
            http: {client: config}
        }
    } = router;

    router.methods.add({
        method: 'method1.in',
        fn: ({payload, error}) => payload
            .concat(['method1.in'])
    });
    router.methods.add({
        method: 'method1.out',
        fn: ({payload, error}) => payload
            .concat(['method1.out'])
    });

    const init = () => {};

    return {
        ...router,
        start: async() => {
            await router.start();
        }
    };
};