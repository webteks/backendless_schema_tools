const _ = require('lodash');
const Comparator = require('./comparator');

class AppRolesCompare extends Comparator {
    constructor(controlApp, appsToCompare) {
        const options = {
            dataPath: 'roles',
            keyBy: 'rolename',
            propsToIgnore: ['roleId'],
            diffConfig: {
                array: {
                    detectMove: false
                },
                objectHash: obj => {
                    return obj.type;
                },
                propertyFilter: (name, context) => {
                    return !_.includes(this.propsToIgnore, name);
                }
            }
        };
        super(controlApp, appsToCompare, options);
    }
}

module.exports = AppRolesCompare;
