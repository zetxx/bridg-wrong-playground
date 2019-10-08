const {serializeError} = require('serialize-error');

module.exports = (Node) => {
    var logWire = null;
    var logQueue = [];
    var queueCleanInterval = null;
    var stopping = false;

    return class Logger extends Node {
        async start() {
            let s = await super.start();
            queueCleanInterval = setInterval(() => this.cleanupLogQueue(), 1000);
            await this.initLogger();
            this.log('info', {in: 'logger.start', description: 'ready'});
            return s;
        }

        async initLogger() {
            try {
                let logger = await this.resolve('logger', 'udp');
                if (!(logger.e instanceof Error)) {
                    return (logWire = logger);
                }
            } catch (error) {
                this.log('error', {in: 'logger.initLogger', error});
                !stopping && this.initLogger();
            }
        }

        cleanupLogQueue() {
            if (logWire && logQueue.length) {
                logQueue.map((entry) => logWire(entry).catch((e) => console.error(e)));
                logQueue = [];
            }
            stopping && clearInterval(queueCleanInterval);
        }

        async log(level, message) {
            if (message && message.error) {
                message.error = (message.error instanceof Error && serializeError(message.error)) || message.error;
            }

            logQueue.push({method: 'log', params: {level, message, fingerPrint: this.getFingerprint()}, meta: {isNotification: 1}});
            this.cleanupLogQueue();
        }

        async stop() {
            stopping = true;
            return super.stop();
        }
    };
};
