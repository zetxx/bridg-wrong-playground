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

        getSpan({tag = 'no tag', parent}) {
            return (parent && this.tracer.startSpan(tag, {childOf: parent})) || this.tracer.startSpan(tag);
        }

        getGlobTrace(meta) {
            let ids = {};
            let parent = this.tracer.extract(FORMAT_HTTP_HEADERS, (meta.globTrace && meta.globTrace.id && {'uber-trace-id': meta.globTrace.id}) || {});
            let span = this.getSpan({tag: 'entry', parent});
            this.tracer.inject(span, FORMAT_HTTP_HEADERS, ids);
            return {id: ids['uber-trace-id'], span};
        }

        getSpanFromMeta(meta) {
            return meta && meta.globTrace && meta.globTrace.span;
        }

        async remoteApiCall({destination, message, meta}) {
            let span = this.getSpanFromMeta(meta);
            try {
                let resp = await super.remoteApiCall({destination, message, meta});
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
                globSpan = this.getSpanFromMeta(meta);
                r = {id, result: await this.apiRequestReceived({...restParsed, meta})};
                meta.globTrace.span.finish();
                return r;
            } catch (e) {
                globSpan && globSpan.setTag(Tags.ERROR, true);
                globSpan && globSpan.finish();
                throw e;
            }
        }

        cleanMeta({globTrace, ...metaClean}) {
            if (!globTrace) {
                return super.cleanMeta(metaClean);
            }
            let {span, ...globTraceNoSpan} = globTrace;
            return {span, ...super.cleanMeta({globTrace: globTraceNoSpan, ...metaClean})};
        }

        stop() {
            this.tracer.close();
            return super.stop();
        }
    }
    return Udp;
};
