const MainNode = require('bridg-wrong');

const execOrder = [
    'state', 'api', 'discovery', 'logger', 'service', 'external'
];

module.exports = (buildList) => {
    return execOrder.reduce((prev, curr) => {
        if (buildList[curr]) {
            var req = [curr];
            buildList[curr].type && req.push(buildList[curr].type);
            return require(`./${req.join('/')}.js`)(prev);
        }
        return prev;
    }, MainNode);
};
