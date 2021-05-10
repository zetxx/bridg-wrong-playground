const {basename} = require('path');

module.exports = async({A}) => {
    let inR = await A.inbound({
        payload: 3,
        meta: {method: 'a.b'}
    });
    setTimeout(A.request.fulfill(inR.request), 100);
    await inR.request.promise;
    return console.info(basename(__filename));
};