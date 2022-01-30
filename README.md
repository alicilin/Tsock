# @connectter/Tsock

Tsock is a node.js tcp server & client library

## Installation

Use the package manager npm to install foobar.

```bash
npm i @connectter/tsock
```

## Usage

```javascript
'use strict';
const { Tserver, Tclient, RedisAdapter } = require('@connectter/tsock');
const server = new Tserver(8080);
const PASS = '1234';

async function main() {
    server.adapter(new RedisAdapter({ host: 'localhost', port: 6379 })); // redis adapter (optional) (cluster mode)
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
        console.log(sock.id); // socket id
        server.clients('testto').then(console.log); //connected client ids
        server.emit('room1', 'test', 'okokook'); // goes to clients in room1 room
        sock.on('test', (msg, res) => { // bind test event
            console.log(msg); // message
            res('okokokok'); // response
        });

        for await (let [msg] of sock.onAsync('test')) { // asyncIterable event
            console.log(msg);
        }

        let [msg, reply] = await sock.onceAsync('test'); // once async event;
        console.log(msg);


        sock.emit('hello', 'hhhello', true).then(console.log); // hello => event name, hhhello => message, true => wait response
        setInterval(() => server.emit('testto', 'hello', 'hhhello'), 500);
        sock.on('disconnect', () => console.log('disconnect', sock.id)); // disconnect event
    });

    await server.listen();

    let tclient = new Tclient('127.0.0.1', 8080);
    await tclient.onceAsync('connect');
    tclient.emit('password', '1234');
    for await (let [x, res] of tclient.onAsync('hello')) {
        console.log(x);
        res('response');
    }

    tclient.on('hello', (msg, res) => {
        console.log(msg);
    });

    let response = await sock.emit('hello', 'hhhello', true);
    console.log(response);
}

main();

```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License
[MIT](https://choosealicense.com/licenses/mit/)