const http = require('http');
const Router = require('../config').Router;

module.exports = (args) => {
    const router = Router({
        ...args,
        log: (level, msg) => console[level](msg)
    });

    return {
        ...router,
        start: async() => {
            await router.start();
        }
    };
};