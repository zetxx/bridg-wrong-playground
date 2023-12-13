const HttpClientFetch = ({
    prev,
    config,
    wires,
    list
}) => {
    class httpClientFetch extends prev({wires, list}) {
        async init(api) {
            this.log('info', 'HttpClientFetch', 'Init');
            this.add({name: this.namespace + '.example.get', fn: (message) => {
                return {a: 1};
            }});
        }
    };
    return httpClientFetch;
};

module.exports = HttpClientFetch;
