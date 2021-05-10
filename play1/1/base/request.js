let cc = 0;
const Request = ({
    nodeId,
    config: {
        waitTime = 30000
    } = {}
} = {}) => {
    let items = [];
    let counter = 0;
    // setInterval(() => {console.log(nodeId, items.length)}, 3000);

    const createRequest = ({
        onLocalReject,
        parent
    }) => {
        counter = counter + 1;
        const request = {
            nodeId,
            idx: counter,
            parent
        };
        request.promise = new Promise(
            (resolve, reject) => {
                request.resolve = resolve;
                request.reject = reject;
            }
        );
        setTimeout(() => {
            onLocalReject({
                error: new Error('request.waitTimeExpired'),
                meta: {
                    idx: request.idx,
                    nodeId
                }
            });
        }, waitTime);
        return request;
    };

    const o = {
        add(packet, onLocalReject) {
            const {meta} = packet;
            const request = createRequest({
                onLocalReject,
                parent: {
                    meta: meta.idx &&
                        meta.nodeId &&
                        meta
                }
            });
            items.push(request);
            return {
                ...packet,
                meta: {
                    ...meta,
                    idx: request.idx,
                    nodeId: request.nodeId
                },
                request
            };
        },
        find({meta: {idx, nodeId: curNodeId = nodeId} = {}} = {}) {
            return items.find(({idx: idxIn}) => (
                idxIn === idx &&
                nodeId === curNodeId
            ));
        },
        fulfill(request) {
            const idx = items.findIndex((r) => r === request);
            if (idx > -1) {
                items = items.slice(0, idx)
                    .concat(items.slice(idx + 1));

                return (packet) => {
                    if (packet.error) {
                        request.reject(packet);
                    }
                    request.resolve(packet);
                };
            } else {
                throw new Error('request.notFound');
            }
        }
    };
    return o;
};

module.exports = Request;