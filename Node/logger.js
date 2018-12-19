const Node = require('./discovery');

class Logger extends Node {
    constructor(args) {
        super(args);
        this.logWire = null;
    }
    start() {
        return super.start()
            .then(() => this.initLogger())
            .then(() => this.log('info', {in: 'start', message: `discovery[${this.name}]: ready`}));
    }

    initLogger() {
        this.resolve('logger')
            .then((logger) => (this.logWire = logger))
            .catch((error) => this.log('error', {error}) | this.initLogger());
        return Promise.resolve();
    }

    log(level, message) {
        if (message && message.error) {
            message.error = (message.error instanceof Error && JSON.parse(JSON.stringify(message.error, Object.getOwnPropertyNames(message.error)))) || message.error;
        }
        this.logWire && this.logWire({method: 'log', params: {level, message, fingerPrint: this.getFingerprint()}, meta: {isNotification: 1}}).catch((e) => console.error(e));
        !this.logWire && super.log(level, message);
        return Promise.resolve({});
    }

    stop() {
        return super.stop();
    }
}

module.exports = Logger;
