const {get} = require('https');

module.exports = (props) => {
    const prev = require('../config')(props);
    const {url} = prev.config;
    prev.methods.add({
        method: ['*', 'out'],
        fn: (rq) => {
            get(url, (res) => {
                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', (chunk) => (rawData += chunk));
                res.on('end', () => {
                    prev.pass({
                        packet: {
                            payload: rawData,
                            header: {
                                method: rq
                                    .header
                                    .method
                                    .slice(-2)
                                    .slice(0, 1)
                                    .concat('in')
                            },
                            match: {
                                idx: rq.header.idx,
                                tag: rq.header.tag
                            }
                        }
                    });
                });
            });
            return rq;
        }
    });
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

    return {
        ...prev,
        async start(...args) {
            return await prev.start(...args);
        }
    };
};
