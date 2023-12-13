const server = require('koa');
const {bodyParser} = require('@koa/bodyparser');
const cors = require('@koa/cors');
const Router = require('@koa/router');
const router = new Router();
const App = new server();

const Koa = ({
    prev,
    config,
    wires,
    list
}) => {
    class koa extends prev({wires, list}) {
        async init(api) {
            this.log('info', 'Koa', 'Init', config);
            router.get('/example', async(ctx) => {
                const res = await this.ask({method: 'http-client.example.get', params: {}});
                ctx.body = res.params;
            });
            App.use(bodyParser())
                .use(cors())
                .use(router.routes())
                .listen(config.server.port, () => {
                    this.log('info', `Server listening http://127.0.0.1:${config.server.port}/`);
                });
            return await super.init();
        }
    };
    return koa;
};

module.exports = Koa;
