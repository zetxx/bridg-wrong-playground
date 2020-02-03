const CustomError = require('bridg-wrong/lib/error');
const Http = CustomError({code: 'Http'});
const Udp = CustomError({code: 'Udp'});

module.exports = {
    Http,
    Udp
};
