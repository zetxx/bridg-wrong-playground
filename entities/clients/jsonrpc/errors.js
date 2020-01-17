const CustomError = require('../../../error');
const Http = CustomError({code: 'Http'});
const Udp = CustomError({code: 'Udp'});

module.exports = {
    Http,
    Udp
};
