const {serializeError} = require('serialize-error');

const logMethodFilterCreator = (fromLevel) => {
    const logMethods = [
        'trace',
        'debug',
        'info',
        'warn',
        'error',
        'fatal'
    ]
        .map((name, i) => ({name: name, idx: i})).reduce((a, {name, idx}) => ({list: a.list.concat(name), map: {...a.map, [name]: idx}}), {list: [], map: {}});

    const testVal = Math.min(...logMethods.list.filter((v, k) => logMethods.list.indexOf(fromLevel) <= k).map((level) => logMethods.map[level]))

    return (level) => {
        return logMethods.map[level] >= testVal;
    };
};

module.exports = (Node) => {
    var logWire = null;
    var logQueue = [];
    var queueCleanInterval = null;
    var stopping = false;

    return class Logger extends Node {
        constructor(...args) {
            super(...args);
            let log = this.getConfig(['log'], {
                level: 'trace'
            });
            this.logMethodFilter = logMethodFilterCreator(log.level);
        }
        async start() {
            let s = await super.start();

            queueCleanInterval = setInterval(() => this.cleanupLogQueue(), 1000);
            await this.initLogger();
            this.log('info', {in: 'logger.start', description: 'ready'});
            return s;
        }

        async initLogger() {
            try {
                let logger = await this.resolve('logger');
                if (!(logger.e instanceof Error)) {
                    return (logWire = logger);
                }
            } catch (error) {
                this.log('error', {in: 'logger.initLogger', error});
                !stopping && this.initLogger();
            }
        }

        cleanupLogQueue() {
            if (logWire && logQueue.length) {
                logQueue.map((entry) => logWire(entry).catch((e) => console.error(e)));
                logQueue = [];
            }
            stopping && clearInterval(queueCleanInterval);
        }

        async log(level, {meta, ...messageLeft}) {
            let message = (meta && {meta: this.cleanMeta(meta).meta, ...messageLeft}) || messageLeft;
            if (!this.logMethodFilter(level)) {
                return;
            }
            if (message && message.error) {
                message.error = (message.error instanceof Error && serializeError(message.error)) || message.error;
            }

            logQueue.push({method: 'log', params: {level, message, fingerPrint: this.getFingerprint()}, meta: {isNotification: 1}});
            this.cleanupLogQueue();
        }

        async stop() {
            stopping = true;
            return super.stop();
        }
    };
};
