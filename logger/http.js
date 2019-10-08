const {serializeError} = require('serialize-error');

module.exports = (Node) => {
    var logWire = null;

    return class Logger extends Node {
        async start() {
            let s = await super.start();
            await this.initLogger();
            this.log('info', {in: 'logger.start', description: 'ready'});
            return s;
        }

        async initLogger() {
            try {
                logWire = await this.resolve('logger');
            } catch (error) {
                this.log('error', {in: 'logger.initLogger', description: 'ready'}, {error});
                this.initLogger();
            }
        }

        async log(level, message) {
            if (message && message.error) {
                message.error = (message.error instanceof Error && serializeError(message.error)) || message.error;
            }
            logWire && logWire({method: 'log', params: {level, message, fingerPrint: this.getFingerprint()}, meta: {isNotification: 1}}).catch((e) => console.error(e));
            !logWire && super.log(level, message);
        }

        stop() {
            return super.stop();
        }
    };
};
