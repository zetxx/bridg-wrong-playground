const {basename} = require('path');

module.exports = async({A, B}) => {
    /* method not found */
    try {
        let inR = await A.inbound({
            payload: 3,
            meta: {method: 'a.b'}
        });
        console.warn(await inR.request.promise);
    } catch (e) {
        console.error(e);
    }

    // try {
    //     let inR = await A.inbound({
    //         payload: 3,
    //         meta: {method: 'b'}
    //     });

    //     setTimeout(() => {
    //         B.inbound({
    //             payload: 3,
    //             meta: {
    //                 method: 'b',
    //                 idx: inR.request.idx
    //             }
    //         });
    //     }, 1);
    //     await inR.request.promise;
    // } catch (e) {
    //     console.error(e);
    // }
    return console.info(basename(__filename));
    
};