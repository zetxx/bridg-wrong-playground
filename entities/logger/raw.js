const {serializeError} = require('serialize-error');

module.exports = (Node) => {
    return class Logger extends Node {
        constructor(...args) {
            super(...args);
            this.setStore(
                ['config', 'log'],
                this.getConfig(['log'], {
                    level: 'trace',
                    logOwn: false, // do we log instance own logs
                    stdout: true // do we pipe to stdout
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
            if (level === 'error') {
                message.error = serializeError(message.error);
            }
            this.logger[level]({...message, pid: this.getNodeId()});
        }

        async stop() {
            return super.stop();
        }
    };
};
