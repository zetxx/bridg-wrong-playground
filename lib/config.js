const config = require('rc')(require(require.main.path + '/package.json').name, {});
const Config = (component) => {
    if (!component) {
        return config;
    }
    return config[component] || {};
};
module.exports = Config;
