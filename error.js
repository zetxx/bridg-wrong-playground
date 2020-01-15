const flatten = require('flat');

const CreateError = ({code, parentError, message}) => {
    class CustomError extends (parentError || Error) {
        constructor({state} = {state: null}, ...params) {
            super(...params);
            // Maintains proper stack trace for where our error was thrown (only available on V8)
            Error.captureStackTrace && Error.captureStackTrace(this, CustomError);

            this.code = (this.code && [this.code, code].join('.')) || code;
            this.state = state && flatten(state);
        }
    }
    return CustomError;
};

module.exports = CreateError;
