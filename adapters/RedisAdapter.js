'use strict';
const BaseAdapter = require('./BaseAdapter');
const Redis = require('ioredis');
const v8 = require('v8');
const { v4 } = require('uuid');
const { on } = require('events');
const _ = require('lodash');

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
            let [id, room, event, message] = v8.deserialize(Buffer.from(msg, 'hex'));
            if (id !== ts.id) {
                ts.emit(room, event, message, false);
            }
        };

        this.sub.on('message', onmsg);
        return true;
    }

    async sendmsg(hex) {
        await this.pub.publish('tcp:msg', hex);
        return true;
    }

    async onclients(ts) {
        let onmsg = async (a, b, msg) => {
            let [id, room] = v8.deserialize(Buffer.from(msg, 'hex'));
            let socks = new Set();
            for await (let value of ts.filterSockets(room)) {
                socks.add(value.id);
            }

            let hex = v8.serialize([id, socks]).toString('hex');
            this.pub.publish(`tcp:socks:${id}:res`, hex);
        };
        
        this.reqsub.on('pmessage', onmsg);
        return true;
    }

    async clients(room) {
        let id = v4();
        let value = v8.serialize(([id, room])).toString('hex');
        let ac = new AbortController();
        let timeout = setTimeout(() => ac.abort(), 120 * 1000);
        let iterable = on(this.ressub, 'pmessage', { signal: ac.signal });
        let nums = await this.pub.publish(`tcp:socks:${id}:req`, value);
        let socks = new Set();
        let i = 1;

        if (nums === 0) {
            return socks;
        }

        for await (let [a, b, buff] of iterable) {
            let [eid, esocks] = v8.deserialize(Buffer.from(buff, 'hex'));
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