'use strict';
const BaseAdapter = require('./BaseAdapter');
const Redis = require('ioredis');
const { Packr } = require('msgpackr');
const { v4 } = require('uuid');
const { on } = require('events');
const _ = require('lodash');
const packr = new Packr();
class RedisAdapter extends BaseAdapter {
    constructor(options) {
        super();
        this.options = options;
        this.redis = new Redis(options);
        this.sub = this.redis.duplicate();
        this.pub = this.redis.duplicate();
        this.reqsub = this.redis.duplicate();
        this.ressub = this.redis.duplicate();
        this.sub.subscribe('tcp:msg');
        this.reqsub.psubscribe('tcp:socks:*:req');
        this.ressub.psubscribe('tcp:socks:*:res');
    }

    async onmsg(ts) {
        let onmsg = (_, msg) => {
            let [id, room, event, message] = packr.unpack(msg);
            if (id !== ts.id) {
                ts.emit(room, event, message, false);
            }
        };

        this.sub.on('messageBuffer', onmsg);
        return true;
    }

    async sendmsg(buffer) {
        await this.pub.publish('tcp:msg', buffer);
        return true;
    }

    async onclients(ts) {
        let onmsg = async (a, b, msg) => {
            let [id, room] = packr.unpack(msg);
            let socks = new Set();
            for await (let value of ts.filterSockets(room)) {
                socks.add(value.id);
            }

            let buff = packr.pack([id, socks]);
            this.pub.publish(`tcp:socks:${id}:res`, buff);
        };
        
        this.reqsub.on('pmessageBuffer', onmsg);
        return true;
    }

    async clients(room) {
        let id = v4();
        let value = packr.pack(([id, room]));
        let ac = new AbortController();
        let timeout = setTimeout(() => ac.abort(), 120 * 1000);
        let iterable = on(this.ressub, 'pmessageBuffer', { signal: ac.signal });
        let nums = await this.pub.publish(`tcp:socks:${id}:req`, value);
        let socks = new Set();
        let i = 1;

        if (nums === 0) {
            return socks;
        }

        for await (let [a, b, buff] of iterable) {
            let [eid, esocks] = packr.unpack(buff);
            if (eid === id) {
                for (let sid of esocks) {
                    socks.add(sid);
                }

                if (++i >= nums) {
                    clearTimeout(timeout);
                    return socks;
                }
            }
        }
    }

}

module.exports = RedisAdapter;