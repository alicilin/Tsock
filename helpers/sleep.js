'use strict';
const { promisify } = require('util');
module.exports = promisify(setTimeout);