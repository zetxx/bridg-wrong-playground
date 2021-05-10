const {basename} = require('path');

module.exports = async({A}) => {
    let outR = await A.outbound({
        payload: 3,
        meta: {method: 'a.b'}
    });
    setTimeout(async() => {
        let inR = await A.inbound({
            payload: outR.payload,
            meta: outR.meta
        });
    }, 100);
    await outR.request.promise;
    return console.info(basename(__filename));
};