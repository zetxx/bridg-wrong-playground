module.exports = (Node) => {
    class Last extends Node {
        start() {
            let s = super.start();
            process.on('SIGINT', () => {
                return (this.stop && this.stop());
            });
            process.on('SIGTERM', () => {
                return (this.stop && this.stop());
            });
            return s;
        }
    }
    return Last;
};
