const {basename} = require('path');

module.exports = async({A}) => {
    let inR = await A.inbound({
        payload: 3,
        meta: {method: 'a.b'}
    });
    setTimeout(async() => {
        let outR = await A.outbound({
            payload: inR.payload,
            meta: inR.meta
        });
    }, 100);
    await inR.request.promise;
    return console.info(basename(__filename));
};