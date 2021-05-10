const init1 = require('./tests/init/1');
const init2 = require('./tests/init/2');
const inboundDirectFullFill = require('./tests/inboundDirectFullFill');
const outboundDirectFullFill = require('./tests/outboundDirectFullFill');
const inboundFullFillThroughOutbound = require('./tests/inboundFullFillThroughOutbound');
const outboundFullFillThroughInbound = require('./tests/outboundFullFillThroughInbound');
const a1 = require('./tests/1');

(async() => {
    // const {A: A1} = (await init1())();
    const {A: A2, B: B2} = (await init2())();

    // await inboundDirectFullFill({A: A1});
    // await outboundDirectFullFill({A: A1});
    // await inboundFullFillThroughOutbound({A: A1});
    // await outboundFullFillThroughInbound({A: A1});
    await a1({A: A2, B: B2});

    console.log('finished');
})();

