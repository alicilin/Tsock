'use strict';
const { Tserver, Tclient, RedisAdapter } = require('./index');
const server = new Tserver(8080);
const PASS = '1234';

async function main() {
    // server.adapter(new RedisAdapter({ host: 'localhost', port: 6379 })); // redis adapter (cluster mode)
    server.use(async (socket, next) => { // middleware
        let [password] = await socket.onceAsync('password');
        if (password !== PASS) {
            return;
        }

        socket.join('testto'); // join room
        //socket.leave('testto') // leave room
        next();
    });

    server.on('connection', async sock => {
        setInterval(() => server.emit('testto', 'hello', 'hhhello'), 500);
        sock.on('disconnect', () => console.log('disconnect', sock.id)); // disconnect event
    });

    await server.listen();

    let tclient = new Tclient('127.0.0.1', 8080);
    tclient.emit('password', '1234');
    await tclient.onceAsync('ready');
    tclient.on('hello', (msg, res) => {
        console.log(msg);
    });
}

main();
