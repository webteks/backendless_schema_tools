const Comparator = require('./comparator');

class RelationCompare extends Comparator {
    constructor(controlApp, appsToCompare, relationType) {
        const options = {
            childAttr: relationType,
            dataPath: 'tables',
            propsToIgnore: ['columnId', 'relatedTable']
        };
        super(controlApp, appsToCompare, options);
    }
}

module.exports = RelationCompare;
