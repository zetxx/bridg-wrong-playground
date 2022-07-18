const rc = require('rc');
const vector = require('bridg-wrong/lib/vector');

module.exports = ({
    app,
    part
}) => {
    const config = rc(app, {
        [part]: {
            vector: {
                request: {
                    waitTime: 30000
                }
            }
        }
    })[part];

    const v = vector({
        config: {
            ...config.vector,
            id: `${app}..${part}`
        }
    });
    return {
        ...v,
        config
    }
};
