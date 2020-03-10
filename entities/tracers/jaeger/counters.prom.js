const client = require('prom-client');

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

module.exports = (Node) => {
    class Counters extends Node {
        async start() {
            this.internalApiMethods['GET/metrics'] = () => client.register.metrics();
            return super.start();
        }
    }
    return Counters;
};
