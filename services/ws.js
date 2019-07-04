const rc = require('rc');
const pso = require('parse-strings-in-object');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const Factory = require('bridg-wrong-playground/factory.js');
const discovery = (pso(rc('', {})).discovery === false && 'direct') || 'mdns';
const Service = Factory({state: true, api: {type: 'udp'}, discovery: {type: discovery}, service: true});

class WS extends Service {
    constructor(args) {
        super(args);
        this.setStore(
            ['config', 'ws'],
            pso(rc(this.getNodeName() || 'buzzer', {
                ws: {
                    http: {
                        port: 10000
                    }
                }
            }).ws)
        );
    }

    start() {
        this.httpServer = http.createServer();
        this.clients = [];
        const wss = new WebSocket.Server({server: this.httpServer});
        var idx = 0;
        wss.on('connection', (ws) => {
            const index = ++idx;
            this.clients.push({socIdx: index, ws});
            ws.on('close', (message) => {
                this.clients = this.clients.reduce((a, {socIdx, ws}) => {
                    if (socIdx !== index) {
                        a.push({socIdx, ws});
                    }
                    return a;
                }, []);
            });
        });
        this.httpServer.listen(this.getStore(['config', 'ws', 'http', 'port']));
        this.lib = {
            publish: (...args) => this.publish(...args)
        };
        return super.start();
    }

    stop() {
        this.clients.map(({ws}) => ws.close());
        this.httpServer.close();
        return super.stop();
    }

    publish(msg) {
        this.clients.map(({ws}) => ws.send(JSON.stringify(msg)));
    }
}

module.exports = (name) => {
    var service = new WS({name: name || 'ws'});

    service.registerApiMethod({
        method: 'log',
        direction: 'in',
        fn: function(msg) {
            this.sharedContext.lib.publish(msg);
            return false;
        }
    });
    service.start()
        .catch((e) => service.log('error', {in: 'ws.ready', error: e}));
};
