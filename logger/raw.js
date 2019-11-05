module.exports = (Node) => {
    return class Logger extends Node {
        async start() {
            let s = await super.start();
            this.log('info', {in: 'logger.start', description: 'ready'});
            return s;
        }

        async initLogger() {}

        async log(level, message) {
            console.log('------------------------');
            if (message && message.error) {
                return console.error(message);
            } else {
                console.log(`${level}: `, message);
            }
            console.log('------------------------');
        }

        async stop() {
            return super.stop();
        }
    };
};
