const {v4} = require('uuid');
const {createServer} = require('http');

module.exports = (props) => {
    const prev = require('../config')(props);
    const {port} = prev.config;
    prev.methods.add({
        method: ['a', 'out'],
        fn: ({payload, error}) => {
            if (error) {
                throw error;
            }
            return payload;
        }
    });
    prev.methods.add({
        method: ['a', 'in'],
        fn: ({payload, error}) => {
            if (error) {
                throw error;
            }
            return payload;
        }
    });
    prev.methods.add({
        method: ['*', 'out'],
        fn: ({payload, error}) => {
            if (error) {
                throw error;
            }
            return payload;
        }
    });

    return {
        ...prev,
        async start(...args) {
            await prev.start(...args);
            const s = createServer(async(req, res) => {
                try {
                    const p = prev.pass({
                        packet: {
                            header: {
                                method: ['a', 'in'],
                                trace: [v4()]
                            },
                            payload: 'hey'
                        }
                    });
                    const {payload} = await p.packet.state.current;
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(payload);
                } catch (e) {
                    console.error(e);
                }
            });
            s.listen(port);
            console.log(`listening: http://localhost:${port}`);
            return prev;
        }
    };
};
