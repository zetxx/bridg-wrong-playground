const config = require('rc')(require(process.cwd() + '/package.json').name, {});
const Config = (component) => {
    if (!component) {
        return config;
    }
    return config[component] || {};
};
module.exports = Config;
