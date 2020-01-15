const flatten = require('flat');

const CreateError = (code, parentError) => {
    class CustomError extends (parentError || Error) {
        constructor({message, state} = {message: '', state: null}, ...params) {
            super(message, ...params);
            // Maintains proper stack trace for where our error was thrown (only available on V8)
            Error.captureStackTrace && Error.captureStackTrace(this, CustomError);

            this.code = (this.code && [this.code, code].join('.')) || code;
            this.state = flatten(state);
        }
    }
    return CustomError;
};

module.exports = CreateError;
