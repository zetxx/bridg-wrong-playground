const MainNode = require('bridg-wrong');

const execOrder = [
    'state', 'api', 'discovery', 'logger', 'service', 'external'
];
module.exports = (buildList) => {
    let producedNode = execOrder.reduce((prev, curr) => {
        if (buildList[curr]) {
            var req = [curr];
            buildList[curr].type && req.push(buildList[curr].type);
            return require(`./${req.join('/')}.js`)(prev);
        }
        return prev;
    }, MainNode);

    // shutdwon and cleanup
    class finalNode extends producedNode {
        start() {
            let s = super.start();
            process.on('SIGINT', () => {
                return (this.stop && this.stop());
            });
            process.on('SIGTERM', () => {
                return (this.stop && this.stop());
            });
            return s;
        }
    }
    return finalNode;
};
