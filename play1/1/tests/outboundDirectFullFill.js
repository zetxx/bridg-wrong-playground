const {basename} = require('path');

module.exports = async({A}) => {
    let outR = await A.outbound({
        payload: 3,
        meta: {method: 'a.b'}
    });
    setTimeout(A.request.fulfill(outR.request), 100);
    await outR.request.promise;
    return console.info(basename(__filename));
};