const {getConfig} = require('bridg-wrong-playground/utils');

module.exports = (Node) => {
    return class Logger extends Node {
        constructor(args) {
            super(args);
            this.setStore(
                ['config', 'log'],
                getConfig(this.getNodeName() || 'buzzer', ['log'], {
                    level: 'trace',
                    logOwn: false,
                    destinations: [],
                    stdout: true
                })
            );
            this.logger = require('pino')({
                prettyPrint: {colorize: true},
                level: this.getStore(['config', 'log', 'level'])
            });
        }
        async start() {
            let s = await super.start();
            this.log('info', {in: 'logger.start', description: 'ready'});
            return s;
        }

        async initLogger() {}

        async log(level, message) {
            this.logger[level]({...message, pid: this.name});
        }

        async stop() {
            return super.stop();
        }
    };
};
