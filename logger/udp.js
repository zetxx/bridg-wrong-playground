const serializeError = require('serialize-error');

module.exports = (Node) => {
    return class Logger extends Node {
        constructor(args) {
            super(args);
            this.logWire = null;
            this.logQueue = [];
            this.queueCleanInterval = null;
            this.stopping = false;
        }
        async start() {
            let s = await super.start();
            this.queueCleanInterval = setInterval(() => this.cleanupLogQueue(), 1000);
            await this.initLogger();
            this.log('info', {in: 'logger.start', message: 'ready'});
            return s;
        }

        async initLogger() {
            try {
                let logger = await this.resolve('logger', 'udp');
                if (!(logger.e instanceof Error)) {
                    return (this.logWire = logger);
                }
            } catch (error) {
                this.log('error', {in: 'logger.initLogger', error});
                !this.stopping && this.initLogger();
            }
        }

        cleanupLogQueue() {
            if (this.logWire && this.logQueue.length) {
                this.logQueue.map((entry) => this.logWire(entry).catch((e) => console.error(e)));
                this.logQueue = [];
            }
            this.stopping && clearInterval(this.queueCleanInterval);
        }

        async log(level, message) {
            if (message && message.error) {
                message.error = (message.error instanceof Error && serializeError(message.error)) || message.error;
            }

            this.logQueue.push({method: 'log', params: {level, message, fingerPrint: this.getFingerprint()}, meta: {isNotification: 1}});
            this.cleanupLogQueue();
        }

        async stop() {
            this.stopping = true;
            return super.stop();
        }
    };
};
