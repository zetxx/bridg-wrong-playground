const initTracer = require('jaeger-client').initTracer;
const {Tags, FORMAT_HTTP_HEADERS} = require('opentracing');

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
            return {id: ids['uber-trace-id'], span};
        }

        async remoteApiRequest({destination, message, meta}) {
            let {globTraceId, ...metaRest} = meta;
            let {span, ...globTraceIdRest} = globTraceId;
            try {
                let resp = await super.remoteApiRequest({destination, message, meta: {...metaRest, globTraceId: globTraceIdRest}});
                span.finish();
                return resp;
            } catch (e) {
                span.setTag(Tags.ERROR, true);
                span.finish();
                throw e;
            }
        }

        async callApiMethod(requestData) {
            let r;
            var globSpan;
            try {
                let {id, parsed} = this.parseIncomingApiCall(requestData);
                let {meta, ...restParsed} = parsed;
                let {globTraceId, ...restMeta} = meta;
                let {span, ...globTraceIdRest} = globTraceId;
                globSpan = span;
                r = {id, result: await this.apiRequestReceived({...restParsed, meta: {...restMeta, globTraceId: globTraceIdRest}})};
                span.finish();
                return r;
            } catch (e) {
                globSpan && globSpan.setTag(Tags.ERROR, true);
                globSpan && globSpan.finish();
                throw e;
            }
        }

        stop() {
            this.tracer.close();
            return super.stop();
        }
    }
    return Udp;
};
