const rc = require('rc');
const Wire = require('bridg-wrong/lib/wire');

module.exports = ({
    app,
    part
}) => {
    const config = rc(app, {
        [part]: {
            wire: {
                packet: {
                    waitTime: 35000
                }
            }
        }
    })[part];

    const prev = Wire({
        log: console.log,
        config: {
            ...config.wire,
            id: `${app}..${part}`
        }
    });
    return {
        ...prev,
        async start(...args) {
            return await prev.start(...args);
        },
        config
    };
};
