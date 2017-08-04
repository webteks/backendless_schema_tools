const _ = require('lodash');
const chalk = require('chalk');
const logHelper = require('../../utils/log-helper');
const jsonDiff = require('jsondiffpatch');

class Comparator {
    constructor(controlApp, appsToCompare, options) {
        this.diffs = {};
        this.keyBy = 'name';
        this.propsToIgnore = [];
        this.diffConfig = {
            objectHash: obj => {
                return obj.name;
            },
            propertyFilter: (name, context) => {
                return !_.includes(this.propsToIgnore, name);
            }
        };

        _.assign(this, {
            appsToCompare,
            controlApp
        });

        _.merge(this, options);

        this.differ = jsonDiff.create(this.diffConfig);
    }

    compareData() {
        this.diffs = {};
        const controlData = this._formatDataForDiff(_.get(this.controlApp, this.dataPath));

        _.each(this.appsToCompare, app => {
            const compareData = this._formatDataForDiff(_.get(app, this.dataPath));
            this.diffs[app.appName] = this.differ.diff(controlData, compareData);
        });

        return jsonDiff.formatters.console.format(this.diffs);
    }


    compareNestedData()  {
        /* Clear diffs */
        this.diffs = {};

        /* Get control app's nested data */
        const controlData = this._getNestedData(_.get(this.controlApp, this.dataPath));

        /* Get all comparing apps' nested data  */
        const appDataToCompare = _.reduce(_.castArray(this.appsToCompare), (compareApps, app) => {
            compareApps[app.appName] = this._getNestedData(_.get(app, this.dataPath));
            return compareApps;
        }, {});

        /* Get diffs for each comparing app compared to control app */
        this.diffs = _.reduce(appDataToCompare, (appDataDiffs, nestedCompareData, appName) => {
            appDataDiffs[appName] = this.differ.diff(controlData, nestedCompareData);
            return appDataDiffs;
        }, {});

        return this.diffs;
    }

    _formatDataForDiff(collection) {
        return _.keyBy(collection, this.keyBy);
    }

    _getNestedData(parentCollection) {
        return _.reduce(parentCollection, (nestedData, item) => {
            nestedData[item[this.keyBy]] = this._formatDataForDiff(item[this.childAttr]);
            return nestedData;
        }, {});
    }
}

module.exports = Comparator;
