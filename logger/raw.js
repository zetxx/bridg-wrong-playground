module.exports = (Node) => {
    return class Logger extends Node {
        async start() {
            let s = await super.start();
            this.log('info', {in: 'logger.start', description: 'ready'});
            return s;
        }

        async initLogger() {}

        async log(level, message) {
            if (message && message.error) {
                return console.error(message);
            }

            console[level](message);
        }

        async stop() {
            return super.stop();
        }
    };
};
