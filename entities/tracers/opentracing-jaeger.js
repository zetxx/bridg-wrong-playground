const initTracer = require('jaeger-client').initTracer;
const {FORMAT_HTTP_HEADERS} = require('opentracing');

const tracer = ({name}) => {
    return initTracer({
        serviceName: name,
        reporter: {
            logSpans: true,
            agentHost: '0.0.0.0',
            agentPort: 6832
        },
        sampler: {
            type: 'const',
            param: 1
        }
    }, {
        tags: {
            [name]: '1.1.2'
        }
    });
};

module.exports = (Node) => {
    class Udp extends Node {
        constructor(...args) {
            super(...args);
            this.tracer = tracer({name: this.resolveName});
        }

        getGlobTraceId(meta) {
            let ids = {};
            let parentSpanContext = this.tracer.extract(FORMAT_HTTP_HEADERS, (meta.globTraceId && meta.globTraceId.id && {'uber-trace-id': meta.globTraceId.id}) || {});
            let span = this.tracer.startSpan('getGlobTraceId', {childOf: parentSpanContext});
            this.tracer.inject(span, FORMAT_HTTP_HEADERS, ids);
            return {id: ids['uber-trace-id']};
        }

        stop() {
            this.tracer.close();
            return super.stop();
        }
    }
    return Udp;
};
