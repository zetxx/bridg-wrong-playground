const serializeError = require('serialize-error');

module.exports = (Node) => {
    return class Logger extends Node {
        constructor(args) {
            super(args);
            this.logWire = null;
        }
        start() {
            return super.start()
                .then(() => this.initLogger())
                .then(() => this.log('info', {in: 'logger.start', message: 'ready'}));
        }

        async initLogger() {
            try {
                this.logWire = await this.resolve('logger');
            } catch (error) {
                this.log('error', {in: 'logger.initLogger', message: 'ready'}, {error});
                this.initLogger();
            }
        }

        async log(level, message) {
            if (message && message.error) {
                message.error = (message.error instanceof Error && serializeError(message.error)) || message.error;
            }
            this.logWire && this.logWire({method: 'log', params: {level, message, fingerPrint: this.getFingerprint(), procesUid: this.pUid}, meta: {isNotification: 1}}).catch((e) => console.error(e));
            !this.logWire && super.log(level, message);
        }

        stop() {
            return super.stop();
        }
    };
};
