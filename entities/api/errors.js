const CustomError = require('../../error');
const Validation = CustomError({code: 'Validation'});
const MissingValidation = CustomError({code: 'missing', parent: Validation});

module.exports = {
    Validation,
    MissingValidation
};
