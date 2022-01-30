'use strict';
class Adapter {
    async onmsg(tserver) {
        // this.sub.subscribe('tcp:pubsub');
        // this.sub.on('messageBuffer', fn);
        throw new Error('owerride onmsg');
    }

    async sendmsg(buff) {
        // this.pub.publish('tcp:pubsub', buff);
        throw new Error('owerride publish');
    }

    async onclients() {
        throw new Error('owerride onclients');
    }

    async clients() {
        throw new Error('owerride onclients');
    }
}

module.exports = Adapter;