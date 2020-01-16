const flatten = require('flat');

const CreateError = ({code, parent, message}) => {
    class CustomError extends (parent || Error) {
        constructor(props, ...rest) {
            if (!rest.length) {
                rest = rest.concat(props);
            }
            super(...rest);
            let {state} = props || {state: null};
            // Maintains proper stack trace for where our error was thrown (only available on V8)
            Error.captureStackTrace && Error.captureStackTrace(this, CustomError);

            this.code = (this.code && [this.code, code].join('.')) || code;
            state && (this.state = flatten(state));
        }
    }
    return CustomError;
};

module.exports = CreateError;
