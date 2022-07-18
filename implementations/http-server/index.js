const {v4} = require('uuid');
const {createServer} = require('http');

module.exports = (props) => {
    const prev = require('../config')(props);
    const {port} = prev.config;
    // register special method
    // prev.methods.add({
    //     method: '*.out',
    //     fn: (args) => (args)
    // });
    prev.methods.add({
        method: 'a.out',
        fn: ({payload, error}) => {
            if (error) {
                throw error;
            }
            return `${payload}.out`;
        }
    });
    prev.methods.add({
        method: 'a.in',
        fn: ({payload, error}) => {
            if (error) {
                throw error;
            }
            return `${payload}.in`;
        }
    });

    return {
        ...prev,
        async start() {
            setTimeout(async() => {
                try {
                    await prev.ctx().router.pass({
                        vector: prev.tag,
                        packet: {
                            meta: {
                                method: 'a',
                                trace: v4()
                            },
                            payload: 'hey'
                        }
                    });
                    console.log(123);
                } catch (e) {
                    console.error('server catch');
                    console.error(e);
                }
            }, 1000);
            // const s = createServer(async(req, res) => {
            //     const response = await prev.ctx().router.pass({
            //         vector: prev.tag,
            //         packet: {
            //             meta: {
            //                 method: 'a',
            //                 trace: v4()
            //             },
            //             payload: 'hey'
            //         }
            //     });
            //     res.writeHead(200, { 'Content-Type': 'application/json' });
            //     res.end('haloz');
            // });
            // s.listen(port);
            console.log(`listening: http://localhost:${port}`);
            return await prev.start();
        }
    };
};