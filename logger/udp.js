const serializeError = require('serialize-error');

module.exports = (Node) => {
    return class Logger extends Node {
        constructor(args) {
            super(args);
            this.logWire = null;
            this.logQueue = [];
        }
        start() {
            return super.start()
                .then(() => setInterval(() => this.cleanupLogQueue(), 1000))
                .then(() => this.initLogger())
                .then(() => this.log('info', {in: 'logger.start', message: 'ready'}));
        }

        async initLogger() {
            try {
                let logger = await this.resolve('logger', 'udp');
                if (!(logger.e instanceof Error)) {
                    return (this.logWire = logger);
                }
            } catch (error) {
                this.log('error', {in: 'logger.initLogger', error});
                this.initLogger();
            }
        }

        cleanupLogQueue() {
            if (this.logWire && this.logQueue.length) {
                this.logQueue.map((entry) => this.logWire(entry).catch((e) => console.error(e)));
                this.logQueue = [];
            }
        }

        log(level, message) {
            if (message && message.error) {
                message.error = (message.error instanceof Error && serializeError(message.error)) || message.error;
            }

            this.logQueue.push({method: 'log', params: {level, message, fingerPrint: this.getFingerprint()}, meta: {isNotification: 1}});
            this.cleanupLogQueue();
            return Promise.resolve({});
        }
    };
};
