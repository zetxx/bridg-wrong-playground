const {Wires, Methods} = require('bridg-wrong');
const Config = require('./config');

const layerProps = (layer, createConfig) => {
    const layerName = layer.name;
    const namespace = createConfig?.namespace || layerName;
    console.info(
        'CONFIG: layerName: ',
        layerName,
        'namespace: ',
        namespace,
        '|',
        [`--${namespace}.${layerName}`, `--${layerName}`]
            .join(' OR '),
        '|'
    );
    return {
        layerName,
        namespace,
        config: {
            ...Config(layerName),
            ...Config(namespace)[layerName],
            namespace
        }
    };
};

module.exports = () => {
    let wires;
    const components = [];
    const allMethods = [];
    if (!wires) {
        wires = Wires(Config('wires') || {});
    }
    const api = {
        create(component, {config: createConfig} = {}) {
            const testConf = layerProps(component[component.length - 1], createConfig, Config);
            if (testConf?.config.disabled === 'true') {
                return api;
            }
            const methodsList = new Map();
            allMethods.push(methodsList);
            // build component
            const Component = component
                .reduce((prev, curr) => {
                    const ln = layerProps(curr, createConfig, Config);
                    console.log(`Add Layer: ${ln.layerName} for namespace ${ln.namespace}`);
                    const comp = curr({
                        prev,
                        config: ln.config,
                        wires,
                        list: methodsList,
                        allMethods
                    });
                    return () => comp;
                },
                () => Methods({
                    wires,
                    list: methodsList,
                    config: layerProps(Methods, createConfig, Config).config
                }));
            const comp = new (Component());
            components.push(comp);
            return api;
        },
        async init() {
            try {
                return await components.reduce(async(a, c) => {
                    const aa = await a;
                    await c.init();
                    return aa.concat(c);
                }, Promise.resolve([]));
            } catch (e) {
                console.error('Init error', e);
                components.map(async(p) => {
                    try {
                        const pr = await p;
                        (pr.stop && await pr.stop());
                    } catch {
                        // skipping failed init
                    }
                });
            }
        }
    };
    return api;
};
