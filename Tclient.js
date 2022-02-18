'use strict';
const Net = require('net');
const { pack, UnpackrStream } = require('msgpackr');
const sleep = require('./helpers/sleep');
const { EventEmitter, on, once } = require('events');
const { v4 } = require('uuid');
const _ = require('lodash');

class Tclient extends EventEmitter {
    constructor(host, port) {
        super();
        this.host = host;
        this.port = port;
        this.connected = false;
        this.sock = new Net.Socket();
        this.sock.setKeepAlive(true, 5000);
        this.setMaxListeners(0);
        this.connect();
    }

    disconnect() {
        this.sock.destroy();
        return this;
    }

    connect() {
        this.sock.removeAllListeners();
        let connect = () => {
            this.connected = true;
            super.emit('connect');
        };

        let close = () => {
            this.connected = false;
            super.emit('disconnect', this);
        };

        this.bindOnData();
        this.sock.on('connect', connect);
        this.sock.on('close', close);
        this.sock.on('error', e => super.emit('error', e));
        this.sock.connect({ host: this.host, port: this.port });
        return this;
    }

    onAsync(event, signal = undefined) {
        return on(this, event, { signal });
    }

    onceAsync(event, signal = undefined) {
        return once(this, event, { signal });
    }

    async bindOnData() {
        try {
            let stream = new UnpackrStream({ mapsAsObjects: true });
            this.sock.pipe(stream);
            for await (let chunk of stream) {
                let [event, vars, id] = chunk;
                if (_.isString(event) && _.isNil(id) === false) {
                    super.emit(event, vars, this.emit.bind(this, `${event}:${id}`));
                }
            }
        } catch (error) {
            
        }
    }

    async emit(event, vars, wait = false) {
        let id = v4();
        for (let i = 0; i < 60; i++) {
            if (this.connected === false) {
                await sleep(1000);
                continue;
            }
            
            break;
        }

        if (this.connected === false) {
            throw new Error('socket is not writable');
        }

        if (wait === true) {
            let ac = new AbortController();
            let timeout = setTimeout(() => ac.abort(), 60 * 1000);
            let res = this.onceAsync(`${event}:${id}`, ac.signal);
            this.sock.write(pack([event, vars, id]));
            return res.then(x => _.first(x)).finally(() => clearTimeout(timeout));
        }

        this.sock.write(pack([event, vars, id]));
        return true;
    }
}

module.exports = Tclient;