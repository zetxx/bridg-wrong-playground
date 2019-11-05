const {getConfig} = require('../utils');
const http = require('http');
const WebSocket = require('ws');
const {factory} = require('../utils');
const discovery = getConfig('', ['resolve'], {}).type || 'mdns';
const Service = factory({state: true, api: {type: 'udp'}, discovery: {type: discovery}, service: true});

class WS extends Service {
    constructor(args) {
        super(args);
        this.setStore(
            ['config', 'ws'],
            getConfig(this.getNodeName() || 'buzzer', ['ws'], {
                listenPort: 10000
            })
        );
    }

    start() {
        this.httpServer = http.createServer();
        this.clients = [];
        const wss = new WebSocket.Server({server: this.httpServer});
        var idx = 0;
        wss.on('connection', (ws) => {
            var channelReportTimeout = setTimeout(() => ws.close(), 5000);

            ws.once('message', (msg) => {
                try {
                    let m = JSON.parse(msg);
                    if (m.channel) {
                        clearTimeout(channelReportTimeout);
                        const index = ++idx;
                        this.clients.push({socIdx: index, ws, channel: m.channel});
                        ws.on('close', (message) => {
                            this.clients = this.clients.reduce((a, {socIdx, ws}) => {
                                if (socIdx !== index) {
                                    a.push({socIdx, ws});
                                }
                                return a;
                            }, []);
                        });
                    }
                } catch (e) {}
            });
        });
        this.httpServer.listen(this.getStore(['config', 'ws', 'listenPort']));
        return super.start();
    }

    stop() {
        this.clients.map(({ws}) => ws.close());
        this.httpServer.close();
        return super.stop();
    }

    publish(toChannel, msg) {
        toChannel && this.clients.map(({ws, channel}) => toChannel === channel && ws.send(JSON.stringify(msg)));
    }
}

module.exports = WS;
