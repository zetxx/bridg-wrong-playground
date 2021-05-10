require('net')
    .createServer((socket) => socket.pipe(socket))
    .listen(9090);