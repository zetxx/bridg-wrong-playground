const Method = require('./method');
const Request = require('./request');
const directions = {
    reversed: {
        in: 'out',
        out: 'in'
    }
};
let id = 0;

class Base {
    constructor({
        config: {
            request = {
                waitTime: 30000
            }
        } = {}
    } = {}) {
        this.config = {
            request
        };
        this.method = Method();
        this.nodeId = Symbol(++id);
        this.request = Request({
            nodeId: this.nodeId,
            config: this.config.request
        });
    }
    async start({other}) {
        this.other = other;
    }
    async redirect({direction, packet, request} = {}) {
        const {payload, error} = packet;
        const {meta, parent} = request;

        if (direction === 'in') {
            (async() => {
                try {
                    const o1 = await this.other?.both?.({
                        direction: directions.reversed[direction],
                        packet: {
                            payload,
                            error,
                            meta: {
                                ...(parent?.meta || {}),
                                ...meta
                            }
                        }
                    });
                    o1 && await o1.request?.promise;
                } catch (e) {
                    console.error(e);
                }
            })();
        }
        return request;
    }
    async inbound(packet) {
        return this.both({direction: 'in', packet});
    }
    async outbound(packet) {
        return this.both({direction: 'out', packet});
    }

    async both({direction, packet}) {
        const requestFound = this.request.find(packet);
        const result1 = await (async() => {
            try {
                return {
                    payload: await this.method.call({
                            direction,
                            packet
                        })
                };
            } catch (error) {
                return {error, payload: undefined};
            }
        })();
        const packetNew = {...packet, ...result1};
        if (!requestFound) {
            const request = this.request.add(
                packetNew,
                (errorFullPacket) => {
                    return this.both({
                        direction: directions.reversed[direction],
                        packet: {
                            ...packetNew,
                            ...errorFullPacket
                        }
                    })
                }
            );
            return this.redirect({
                direction,
                request,
                packet: packetNew
            });
        }
        this.request.fulfill(requestFound)(packetNew);
        return this.redirect({
            direction,
            packet: packetNew,
            request: requestFound
        });
        
    }
}

module.exports = Base;
