const Node = require('./discovery');

class Logger extends Node {
    constructor(args) {
        super(args);
        this.logWire = null;
    }
    start() {
        return super.start()
            .then((httpApi) => this.resolve('logger'))
            .then((logger) => (this.logWire = logger))
            .then(() => this.log('info', {in: 'start', message: `discovery[${this.name}]: ready`}));
    }

    log(level, message) {
        super.log(level, message)
            .then(() => (this.logWire && this.logWire({method: 'log', params: {level, message}, meta: {isNotification: 1}})))
            .catch((e) => {});
        return Promise.resolve({});
    }

    stop() {
        return super.stop();
    }
}

module.exports = Logger;
