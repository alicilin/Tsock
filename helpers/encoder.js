'use strict';
const { encode } = require('msgpackr');
const { delimiter } = require('../consts/consts');
function encoder(value) {
    return delimiter + encode(value).toString('hex') + delimiter;
}

module.exports = encoder;