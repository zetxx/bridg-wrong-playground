const {serializeError} = require('serialize-error');
const initTracer = require('jaeger-client').initTracer;
const PrometheusMetricsFactory = require('jaeger-client').PrometheusMetricsFactory;
const promClient = require('prom-client');
const {Tags, FORMAT_HTTP_HEADERS} = require('opentracing');
const transportTcp = require('./tcp');
const countersProm = require('./counters.prom');

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
        },
        metrics: new PrometheusMetricsFactory(promClient, name)
    });
};

module.exports = (Node, {transport, counters}) => {
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
            let parent = this.tracer.extract(FORMAT_HTTP_HEADERS, id && {'uber-trace-id': id});
            return this.getSpan({name: spanName, parent});
        }

        getGlobTrace({globTrace}) {
            return globTrace;
        }

        async remoteApiCall({destination, message, meta}) {
            let span = this.createSpan('remoteApiCall', meta);
            span.setTag('destination', destination);
            span.setTag('message', message);

            try {
                let resp = await super.remoteApiCall({destination, message, meta});
                span.finish();
                return resp;
            } catch (e) {
                span.setTag(Tags.ERROR, true);
                span.log({event: 'error', error: serializeError(e)});
                span.finish();
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
                span.log({event: 'error', error: serializeError(e)});
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
            try {
                let r = super.callRegisteredMethod(fn, ctx, ...args);
                span.finish();
                return r;
            } catch (e) {
                span.setTag(Tags.ERROR, true);
                span.log({event: 'error', error: serializeError(e)});
                span.finish();
            }
        }

        stop() {
            this.tracer.close();
            return super.stop();
        }
    }
    const c1 = (transport === 'tcp' && transportTcp(Jaeger)) || Jaeger;
    return (counters === 'prom' && countersProm(c1)) || c1;
};
