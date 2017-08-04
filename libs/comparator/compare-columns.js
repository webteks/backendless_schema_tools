const _ = require('lodash');
const chalk = require('chalk');
const logHelper = require('../../utils/log-helper');
const jsonDiff = require('jsondiffpatch');
const Comparator = require('./comparator');

class ColumnCompare extends Comparator {
    constructor(controlApp, appsToCompare) {
        const options = {
            childAttr: 'columns',
            dataPath: 'tables',
            propsToIgnore: ['columnId']
        };
        super(controlApp, appsToCompare, options);
    }
}

module.exports = ColumnCompare;
