const {Wires, Methods} = require('bridg-wrong');
const Config = require('./config');

const layerProps = (layer, createConfig, config) => {
    const layerName = layer.name.toLowerCase();
    const namespace = createConfig?.namespace || layerName;
    const confNsLy = Config(namespace)[layerName];
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
    if (!wires) {
        wires = Wires(Config('wires') || {});
    }
    const api = {
        create(componen, {config: createConfig} = {}) {
            const testConf = layerProps(componen[componen.length - 1], createConfig, Config);
            if (testConf?.config.disabled === 'true') {
                return api;
            }
            const methodsList = new Map();
            // build component
            const Component = componen
                .reduce((prev, curr, idx) => {
                        const ln = layerProps(curr, createConfig, Config);
                        console.log(`Add Layer: ${ln.layerName} for namespace ${ln.namespace}`);
                        const comp = curr({
                            prev,
                            config: ln.config
                        });
                        return () => comp;
                    },
                    () => Methods({
                        wires,
                        list: methodsList,
                        config: layerProps(Methods, createConfig, Config).config
                    })
                );
            const comp = new (Component());
            components.push(comp.init());
            return api;
        },
        async init() {
            return await Promise.all(components);
        }
    };
    return api;
};
