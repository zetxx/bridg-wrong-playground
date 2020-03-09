const initTracer = require('jaeger-client').initTracer;
const {Tags, FORMAT_HTTP_HEADERS} = require('opentracing');
const transportTcp = require('./tcp');

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

module.exports = (Node, {transport}) => {
    class Jaeger extends Node {
        constructor(...args) {
            super(...args);
            this.tracer = tracer({name: this.resolveName});
        }

        getSpan({name = 'no name', parent}) {
            return (parent && this.tracer.startSpan(name, {childOf: parent})) || this.tracer.startSpan(name);
        }

        async triggerEvent(event, props = {}) {
            let {span: initSpan, ...meta} = this.createGlobTrace({name: 'event.init'});
            let ev = await super.triggerEvent(event, {message: props.message, meta: {...props.meta, ...meta, parentSpan: initSpan}});
            initSpan.finish();
            return ev;
        }

        createGlobTrace({name = 'first'} = {}) {
            let ids = {};
            let parent = this.tracer.extract(FORMAT_HTTP_HEADERS, {});
            let span = this.getSpan({name, parent});
            this.tracer.inject(span, FORMAT_HTTP_HEADERS, ids);
            return {globTrace: {id: ids['uber-trace-id']}, span};
        }

        createSpan(spanName, {parentSpan, globTrace: {id} = {}} = {}) {
            if (parentSpan) {
                return this.getSpan({name: spanName, parent: parentSpan});
            }
            let parent = this.tracer.extract(FORMAT_HTTP_HEADERS, {'uber-trace-id': id});
            return this.getSpan({name: spanName, parent});
        }

        getGlobTrace({globTrace}) {
            return globTrace;
        }

        async remoteApiCall({destination, message, meta}) {
            try {
                let span = this.createSpan('remoteApiCall', meta);
                span.setTag('destination', destination);
                let resp = await super.remoteApiCall({destination, message, meta});
                span.finish();
                return resp;
            } catch (e) {
                throw e;
            }
        }

        async callApiMethod(requestData) {
            let r;
            let {id, parsed} = this.parseIncomingApiCall(requestData);
            let span = this.createSpan('httpIn', parsed.meta);
            try {
                let {meta, ...restParsed} = parsed;
                span.setTag('method', meta.method);
                r = {id, result: await this.apiRequestReceived({...restParsed, meta: {...meta, parentSpan: span}})};
                span.finish();
                return r;
            } catch (e) {
                !e.id && (e.setId(id));
                span.setTag(Tags.ERROR, true);
                span.finish();
                throw e;
            }
        }

        cleanMeta({parentSpan, ...meta}) {
            return meta;
        }

        callRegisteredMethod(fn, ctx, ...args) {
            let [, meta] = args;
            let span = this.createSpan('transformerCall', meta);
            meta.channel && span.setTag('channel', meta.channel);
            meta.method && span.setTag('method', meta.method);
            let r = super.callRegisteredMethod(fn, ctx, ...args);
            span.finish();
            return r;
        }

        stop() {
            this.tracer.close();
            return super.stop();
        }
    }
    return (transport === 'tcp' && transportTcp(Jaeger)) || Jaeger;
};
