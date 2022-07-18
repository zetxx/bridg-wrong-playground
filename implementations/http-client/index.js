const {get} = require('https');

module.exports = (props) => {
    const vector = require('../config')(props);
    const {url} = vector.config;
    // register special method
    vector.methods.add({
        method: '*.out',
        fn: (rq) => {
            // implement http client
            get(url, (res) => {
                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', (chunk) => (rawData += chunk));
                res.on('end', () => {
                    vector.pass({
                        packet: {
                            payload: [rq.payload, rawData],
                            match: {
                                idx: rq.request.idx,
                                tag: rq.request.tag
                            }
                        }
                    });
                });
            });
            return rq;
        }
    });
    vector.methods.add({
        method: 'a.out',
        fn: ({payload, error}) => {
            if (error) {
                throw error;
            }
            return payload;
        }
    });
    vector.methods.add({
        method: 'a.in',
        fn: ({payload, error}) => {
            if (error) {
                throw error;
            }
            return payload;
        }
    });

    return vector;
};