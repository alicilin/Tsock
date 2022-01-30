'use strict';
const nextTick = require('./nextTick');
const v8 = require('v8');
const { delimiter } = require('../consts/consts');

async function indexOfAsync(str, search, from = 0) {
    let start = from;
    while (true) {
        await nextTick();
        let sub = str.slice(start, start + search.length);
        if (sub === search) {
            return start;
        }

        start++;
        if (start > str.length) {
            return - 1;
        }
    }
}

async function *parser(str) {
    while (true) {
        await nextTick();
        let ix1 = await indexOfAsync(str, delimiter);
        if (ix1 === -1) {
            yield str;
            return;
        }

        await nextTick();
        let ix2 = await indexOfAsync(str, delimiter, ix1 + delimiter.length);
        if (ix2 === -1) {
            yield str;
            return;
        }

        yield v8.deserialize(Buffer.from(str.slice(ix1 + delimiter.length, ix2), 'hex'));
        await nextTick();
        str = str.slice(ix2 + delimiter.length);
    }
}

module.exports = parser;