const {v4: uuidv4} = require('uuid');

function mergeDeep(...objects) {
    const isObject = obj => obj && typeof obj === 'object';

    return objects.reduce((prev, obj) => {
        Object.keys(obj).forEach(key => {
            const pVal = prev[key];
            const oVal = obj[key];

            if (Array.isArray(pVal) && Array.isArray(oVal)) {
                prev[key] = pVal.concat(...oVal);
            }
            else if (isObject(pVal) && isObject(oVal)) {
                prev[key] = mergeDeep(pVal, oVal);
            }
            else {
                prev[key] = oVal;
            }
        });

        return prev;
    }, {});
}

const counter = () => {
    let requestCounter = 0;
    return () => {
        if (Number.MAX_SAFE_INTEGER === requestCounter) {
            requestCounter = 0;
        }
        return ++requestCounter;
    };
};

const remoteMsgEncode = (message) => {
    if (message.error) {
        message.error = message.error.toString();
    }
    const d = Buffer.from(JSON.stringify(message), 'utf8');
    const size = Buffer.from([0, 0]);
    size.writeInt16BE(d.length, 0);
    return Buffer.concat([size, d]);
};

const remoteMsgLen = (data) => {
    return data.readInt16BE() + 2;
};

const remoteMsgDecode = (data) => {
    return JSON.parse(data.slice(2));
};
const initMeta = () => ({
    passTrough: {traceId: uuidv4(), time: process.hrtime()},
});

async function sleep(timeInSeconds) {
    return new Promise(
        (resolve) => setTimeout(resolve, timeInSeconds)
    );
};

module.exports = {
    sleep,
    mergeDeep,
    counter,
    remoteMsgEncode,
    remoteMsgLen,
    remoteMsgDecode,
    initMeta
};
