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
                .then(() => this.log('info', {in: 'start', message: `Logger: ready`}));
        }

        initLogger() {
            this.resolve('logger', 'udp')
                .then((logger) => {
                    if (!(logger.e instanceof Error)) {
                        return (this.logWire = logger);
                    }
                    throw logger.e;
                })
                .catch((error) => (this.log('error', {error}) | this.initLogger()));
            return Promise.resolve();
        }

        cleanupLogQueue() {
            if (this.logWire && this.logQueue.length) {
                this.logQueue.map((entry) => this.logWire(entry).catch((e) => console.error(e)));
                this.logQueue = [];
            }
        }

        log(level, message) {
            if (message && message.error) {
                message.error = (message.error instanceof Error && JSON.parse(JSON.stringify(message.error, Object.getOwnPropertyNames(message.error)))) || message.error;
            }

            this.logQueue.push({method: 'log', params: {level, message, fingerPrint: this.getFingerprint()}, meta: {isNotification: 1}});
            this.cleanupLogQueue();
            return Promise.resolve({});
        }

        stop() {
            return super.stop();
        }
    };
};
