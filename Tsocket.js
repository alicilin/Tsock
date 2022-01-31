'use strict';
const parser = require('./helpers/parser');
const encoder = require('./helpers/encoder');
const { EventEmitter, on, once } = require('events');
const { v4 } = require('uuid');
const _ = require('lodash');


class Tsocket extends EventEmitter {
    constructor(sock) {
        super();
        this.sock = sock;
        this.id = v4();
        this.rooms = new Set([this.id]);
        this.sock.on('close', () => super.emit('disconnect', this));
        this.sock.on('error', e => super.emit('error', e));
        this.setMaxListeners(0);
        this.tstr = '';
        this.bindOnData();
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

    join(room) {
        this.rooms.add(room);
        return this;
    }

    leave(room) {
        this.rooms.delete(room);
        return this;
    }

    onAsync(event, signal = undefined) {
        return on(this, event, { signal });
    }

    onceAsync(event, signal = undefined) {
        return once(this, event, { signal });
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
    }
}

module.exports = Tsocket;