const rc = require('rc');
const bw = require('bridg-wrong');

module.exports = {
    Router: ({app, routerId, ...rest}) => {
        const config = rc(app);
        const inst = bw.Router({
            ...rest,
            config: {
                id: routerId,
                ...(config.router || {})
            }
        });

        return {
            ...inst,
            config: {
                app,
                ...config
            },
            start: async() => {
                await inst.start();
            }
        };
    }
};