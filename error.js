const flatten = require('flat');

const CreateError = ({code, parent, message}) => {
    class CustomError extends (parent || Error) {
        constructor(message = code, props = {state: null}) {
            super(message);
            let {state, id} = props;
            // Maintains proper stack trace for where our error was thrown (only available on V8)
            Error.captureStackTrace && Error.captureStackTrace(this, CustomError);

            this.code = (this.code && [this.code, code].join('.')) || code;
            state && (this.state = flatten(state));
            id && (this.id = id);
        }
    }
    return CustomError;
};

module.exports = CreateError;
