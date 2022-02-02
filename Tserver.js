'use strict';
const Net = require('net');
const nextTick = require('./helpers/nextTick');
const Tsocket = require('./Tsocket');
const BaseAdapter = require('./adapters/BaseAdapter');
const { EventEmitter, on, once } = require('events');
const { v4 } = require('uuid');
const { encode } = require('msgpackr');
const _ = require('lodash');

class Tserver extends EventEmitter {
    static sockets = new Set();
    constructor(port) {
        super();
        this.port = port;
        this.id = v4();
        this.server = new Net.Server();
        this.middlewares = [];
        this.adt = null;
        this.setMaxListeners(0);
    }


    async *filterSockets(room) {
        for (let value of this.constructor.sockets) {
            await nextTick();
            let finder = x => value.rooms.has(x);
            if (_.isArray(room) && _.find(room, finder)) {
                yield value;
                continue;
            }

            if (value.rooms.has(room)) {
                yield value;
            }
        }
    }

    async findSocket(room) {
        for (let value of this.constructor.sockets) {
            await nextTick();
            let finder = x => value.rooms.has(x);
            if (_.isArray(room) && _.find(room, finder)) {
                return value;
            }

            if (value.rooms.has(room)) {
                return value;
            }
        }

        return null;
    }

    adapter(adt) {
        if (adt instanceof BaseAdapter) {
            this.adt = adt;
        }
    }

    use(cb) {
        if (_.isFunction(cb)) {
            this.middlewares.push(cb);
        }
    }

    to(room) {
        return {
            emit: this.emit.bind(this, room),
            clients: this.emit.bind(this, room)
        }
    }

    async emit(room, event, message, publish = true) {
        if (!_.isString(event)) {
            throw new Error('event name must be string');
        }

        if (publish && this.adt) {
            let buff = encode([this.id, room, event, message]);
            this.adt.sendmsg(buff.toString('hex'));
        }

        for await (let sock of this.filterSockets(room)) {
            sock.emit(event, message);
        }
    }

    async clients(room) {
        if (this.adt) {
            return await this.adt.clients(room);
        }

        let socks = new Set();
        for await (let { id } of this.filterSockets(room)) {
            socks.add(id);
        }

        return socks;
    }

    async connection(sock) {
        let socket = new Tsocket(sock);
        let nexter = middleware => (
            resolve => {
                let discard = () => resolve(false);
                let id = setTimeout(discard, 60 * 1000);
                let next = () => {
                    clearTimeout(id);
                    resolve(true);
                };

                middleware(socket, next);
            }
        );

        for (let middleware of this.middlewares) {
            let isNext = await new Promise(nexter(middleware));
            if (isNext === false) {
                return sock.destroy();
            }
        }

        this.constructor.sockets.add(socket);
        super.emit('connection', socket);
        sock.on('close', () => this.constructor.sockets.delete(socket));
        setImmediate(() => socket.emit('ready', true));
    }

    onAsync(event, signal = undefined) {
        return on(this, event, { signal });
    }

    onceAsync(event, signal = undefined) {
        return once(this, event, { signal });
    }

    async listen() {
        if (_.isNil(this.adt) === false) {
            this.adt.onmsg(this);
            this.adt.onclients(this);
        }

        this.server.on('connection', this.connection.bind(this));
        return new Promise(x => this.server.listen(this.port, () => x(this)));
    }
}

module.exports = Tserver;