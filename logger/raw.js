module.exports = (Node) => {
    return class Logger extends Node {
        async start() {
            let s = await super.start();
            this.log('info', {in: 'logger.start', description: 'ready'});
            return s;
        }

        async initLogger() {}

        async log(level, message) {
            console.log(this.getFingerprint(), '------------------------');
            try {
                var beautified = JSON.stringify(message, null, 4);
            } catch (e) {}

            if (level === 'error' || (message && message.args && message.args.error)) {
                (message.args && message.args.error) && (console.error(message.args.error) | console.log('error', beautified));
                (!message.args || !message.args.error) && console.log('error', beautified);
                return 1;
            } else {
                console.log(`${level}: `, beautified);
            }
            console.log('------------------------');
        }

        async stop() {
            return super.stop();
        }
    };
};
