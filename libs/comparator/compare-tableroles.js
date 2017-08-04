const _ = require('lodash');
const Comparator = require('./comparator');

class TableRolesCompare extends Comparator {
    constructor(controlApp, appsToCompare, relationType) {
        const options = {
            childAttr: 'roles',
            dataPath: 'tables',
            propsToIgnore: ['roleId'],
            diffConfig: {
                objectHash: obj => {
                    return obj.operation;
                },
                propertyFilter: (name, context) => {
                    return !_.includes(this.propsToIgnore, name);
                }
            }
        };
        super(controlApp, appsToCompare, options);
    }
}

module.exports = TableRolesCompare;
