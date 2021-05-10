const http = require('http');
const net = require('net');
const echo = require('./echo');
const Bridge = require('./base');
const {serializeError} = require('serialize-error');

const httpServer = ({prevNode}) => {
    return class httpS extends prevNode {
        async start(...args) {
            const s = http
                .createServer();
            s.on('request', async(req, res) => {
                const packet = await new Promise((resolve, reject) => {
                    const d = [];
                    req.on('data', (dd) => d.push(dd.toString('utf8')));
                    req.on('end', () => resolve(JSON.parse(d.join(''))));
                    req.on('error', reject);
                });
                try {
                    const r = await this.inbound(packet);
                    res.writeHead(200, {
                        'Content-Type': 'application/json'
                    });
                    const r2 = await this.inbound(r);
                    res.end(JSON.stringify({payload: r2}));
                } catch (e) {
                    res.writeHead(500, {
                        'Content-Type': 'application/json'
                    });
                    res.end(JSON.stringify({error: serializeError(e)}));
                }
            });
            s.listen(8080);
            return super.start(...args);
        }
        async outbound(packet) {
            const requestFound = this.request.find(packet);
            const payload = await super.outbound(packet);
            if (!requestFound) {
                throw new Error('http.server.incorrectFlow');
            } else {
                return this.request.fulfill(requestFound)({...packet, payload});
            }
        }
    }
}
const tcpClient = ({prevNode}) => {
    return class tcpC extends prevNode {
        async start(...args) {
            this.wire = new net.Socket();
            this.wire.connect(9090, () => {
                console.log('Connected');
            });

            this.wire.on('data', async(p) => {
                const packet = JSON.parse(p.toString('utf8'));
                packet.meta = {...packet.meta, method: 'a.b'};
                await this.inbound(
                    packet
                );
            });

            this.wire.on('close', () => {
                console.log('Connection closed');
            });
            return super.start(...args);
        }
        async outbound(packet) {
            const payload = await super.outbound(packet);
            const [taggedPacket, {promise}] = this.request.add({...packet, payload});
            this.wire.write(JSON.stringify({
                payload: {a1: payload, b1: 3},
                meta: {idx: packet.meta.idx}
            }));
            return promise;
        }
    }
}

(async() => {
    const A = Bridge({
        external: {
            build: [
                tcpClient
            ]
        },
        internal: {
            build: [
                httpServer
            ]
        }
    });
    
    A.internal.method.add({
        method: 'a.b.in',
        fn: ({payload: {a1, b1}}) => {
            return a1 + b1;
        }
    });
    A.internal.method.add({
        method: 'a.b.out', fn: ({payload}) => {
            return payload + 43;
        }
    });

    A.external.method.add({
        method: 'a.b.in', fn: ({payload: {a1, b1}}) => {
            return a1 + b1;
        }
    });
    A.external.method.add({
        method: 'a.b.out', fn: ({payload}) => {
            return payload + 3;
        }
    });

    await A.start();
})();
