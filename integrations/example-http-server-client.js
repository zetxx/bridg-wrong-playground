const component = require('./loader');
const componentFactory = component();
componentFactory
    .create([
            require('./logger'),
            require('./http-fetch')
        ], {config: {namespace: 'http-client'}}
    )
    .create([
            require('./logger'),
            require('./http-koa')
        ], {config: {namespace: 'http-server'}}
    );