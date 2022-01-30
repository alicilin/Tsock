'use strict';
const Net = require('net');
const parser = require('./helpers/parser');
const encoder = require('./helpers/encoder');
const { EventEmitter, on, once } = require('events');
const { v4 } = require('uuid');
const _ = require('lodash');

class Tclient extends EventEmitter {
    constructor(host, port) {
        super();
        this.host = host;
        this.port = port;
        this.sock = new Net.Socket();
        this.setMaxListeners(0);
        this.tstr = '';
    }

    disconnect() {
        this.sock.destroy();
        return this;
    }

    async connect() {
        this.sock.on('connect', () => super.emit('connect'));
        this.sock.on('close', () => super.emit('disconnect', this));
        this.sock.on('error', e => super.emit('error', e));
        this.bindOnData();
        let ccb = r => this.sock.connect({ host: this.host, port: this.port }, r);
        let rcb = () => this.onceAsync('ready');
        let rdcb = ([ready]) => {
            if (ready === false) {
                this.disconnect();
                super.emit('error', new Error('Handshake Error'));
            }
        };

        await new Promise(ccb).then(rcb).then(rdcb);
    }

    onAsync(event, signal = undefined) {
        return on(this, event, { signal });
    }

    onceAsync(event, signal = undefined) {
        return once(this, event, { signal });
    }

    async bindOnData() {
        for await (let chunk of on(this.sock, 'data')) {
            this.tstr += chunk.toString('utf-8');
            for await (let value of parser(this.tstr)) {
                if (_.isString(value)) {
                    this.tstr = value;
                    break;
                }

                let [event, vars, id] = value;
                if (_.isString(event) && _.isNil(id) === false) {
                    super.emit(event, vars, this.emit.bind(this, `${event}:${id}`));
                }
            }
        }
    }

    async emit(event, vars, wait = false) {
        let id = v4();
        if (wait === true) {
            let ac = new AbortController();
            let timeout = setTimeout(() => ac.abort(), 60 * 1000);
            let res = this.onceAsync(`${event}:${id}`, ac.signal);
            this.sock.write(encoder([event, vars, id]));
            return res.then(x => _.first(x)).finally(() => clearTimeout(timeout));
        }

        this.sock.write(encoder([event, vars, id]));
        return true;
    }
}

module.exports = Tclient;