const initTracer = require('jaeger-client').initTracer;

var config = {
    serviceName: 'my-awesome-service',
    reporter: {
        'logSpans': true,
        'agentHost': '0.0.0.0',
        'agentPort': 6832
    },
    'sampler': {
        'type': 'probabilistic',
        'param': 1.0
    }
};
const tracer = initTracer(config, {
    tags: {
        'my-awesome-service.version': '1.1.2'
    }
});

module.exports = (Node) => {
    class Udp extends Node {
        async start() {
            const initApp = tracer.startSpan('init_app');
            let r = await super.start();
            initApp.finish();
            return r;
        }
    }
    return Udp;
};
