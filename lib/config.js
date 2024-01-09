const config = require('rc')(require('./package.json').name, {});
const Config = (component) => {
    if (!component) {
        return config;
    }
    return config[component] || {};
};
module.exports = Config;
