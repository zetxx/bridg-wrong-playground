const {base} = require('../../base');
require('../../echo');

module.exports = async() => {
    const A = new base({config: {request: {waitTime: 5000000}}});
    
    A.method.add({
        method: 'a.b.in',
        fn: ({payload}) => payload + 1
    });
    A.method.add({
        method: 'a.b.out',
        fn: ({payload}) => payload + 43
    });
    A.method.add({
        method: 'b.in',
        fn: ({payload}) => payload + 1
    });
    A.method.add({
        method: 'b.out',
        fn: ({payload}) => payload + 43
    });

    const B = new base({config: {request: {waitTime: 2000}}});
    B.method.add({
        method: 'b.in',
        fn: ({payload}) => payload + 1
    });
    B.method.add({
        method: 'b.out',
        fn: ({payload}) => payload + 43
    });
    await A.start({other: B});
    await B.start({other: A});
    return () => ({A, B});
};