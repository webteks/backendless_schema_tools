const Comparator = require('./comparator');

class TableCompare extends Comparator {
    constructor(controlApp, appsToCompare) {
        const options =  {
            propsToIgnore: [
                'columnId',
                'relatedTable',
                'size',
                'tableId',
                'dataSize'
            ],
            dataPath: 'tables'
        };

        super(controlApp, appsToCompare, options);
    }
}

module.exports = TableCompare;
