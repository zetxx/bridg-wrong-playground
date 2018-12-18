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
        this.logWire && this.logWire({method: 'log', params: {level, message}, meta: {isNotification: 1}});
        !this.logWire && super.log(level, message);
        return Promise.resolve({});
    }

    stop() {
        return super.stop();
    }
}

module.exports = Logger;
