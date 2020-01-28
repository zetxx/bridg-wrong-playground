const {getConfig, factory} = require('../utils');
const {Client} = require('@elastic/elasticsearch');
const client = new Client({node: 'http://0.0.0.0:9200'});

module.exports = (id) => {
    const discovery = getConfig(id, ['discovery'], {}).type || 'mdns';
    const Service = factory({state: true, api: {type: 'udp'}, discovery: {type: discovery}, service: true});

    class Es extends Service {
        constructor(args) {
            super(args);
            this.setStore(
                ['config', 'elasticsearch'],
                this.getConfig(['elasticsearch'], {
                    listen: {
                        host: '0.0.0.0',
                        port: '9200'
                    },
                    proto: 'http',
                    silent: true
                })
            );
        }

        async push(body) {
            return client.index({
                index: 'es-log',
                body
            });
        }

        start() {
            var service = this;
            this.registerApiMethod({
                method: 'log',
                direction: 'in',
                meta: {
                    isNotification: 1
                },
                fn: function(msg) {
                    service.push(msg);
                    return false;
                }
            });
            return super.start();
        }

        log(...args) {
            !this.getStore(['config', 'elasticsearch', 'silent']) && super.log(...args);
        }
    }
    return Es;
};
