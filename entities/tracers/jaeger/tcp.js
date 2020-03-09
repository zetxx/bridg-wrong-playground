module.exports = (Node) => {
    class JaegerTcp extends Node {
        matchExternalInToTx(packet) {
            let {apiRequestId, globTrace} = super.matchExternalInToTx(packet);
            if (!globTrace) {
                let {globTrace: globTraceNew, span} = this.createGlobTrace({name: 'tcp.init'});
                span.finish();
                return {apiRequestId, globTrace: globTraceNew};
            }
            return {apiRequestId, globTrace};
        }
    }
    return JaegerTcp;
};
