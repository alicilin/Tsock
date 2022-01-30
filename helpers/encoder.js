'use strict';
const v8 = require('v8');
const { delimiter } = require('../consts/consts');
function encoder(value) {
    let hex = v8.serialize(value).toString('hex');
    return delimiter + hex + delimiter;
}

module.exports = encoder;