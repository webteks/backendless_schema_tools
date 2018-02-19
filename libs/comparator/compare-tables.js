const _ = require('lodash');
const Comparator = require('./comparator');
const Table = require('cli-table');
const chalk = require('chalk');

const SYSTEM_COLUMNS = ['created', 'updated', 'ownerId', 'objectId']

const buildColumnsMap = table => {
    const result = {}

    table.columns.forEach(column => {
        if (!SYSTEM_COLUMNS.includes(column.name)) {
            const options = [column.dataType]

            column.unique && (options.push('UQ'))
            column.required && (options.push('NN'))
            column.indexed && (options.push('IDX'))
            column.defaultValue && (options.push(`DEFAULT:${column.defaultValue}`))

            column.options = options
            column.optionsString = options.join(', ')

            result[column.name] = column
        }
    })

    if (table.relations) {
        table.relations.forEach(relation => {
            const column = {
                dataType: relation.toTableName,
                required: relation.required,
                unique: relation.unique,
                autoLoad: relation.autoLoad,
                relationType: relation.relationshipType
            }

            const options = [`${relation.toTableName}(${relationTypeAlias(column.relationType)})`]
            column.unique && (options.push('UQ'))
            column.required && (options.push('NN'))

            column.options = options
            column.optionsString = options.join(', ')

            result[relation.columnName] = column
        })
    }

    if (table.roles) {
        console.log(table)
    }

    return result
}

const relationTypeAlias = relationType => relationType === 'ONE_TO_ONE' ? '1:1' : '1:N'

const containsDifferences = (apps, columnName, columnsMap) => {
    const versions = _.uniqBy(apps, app => {
        const appColumn = columnsMap[columnName][app.name]

        return appColumn ? appColumn.optionsString : ''
    })

    return versions.length > 1
}

const hasDifferences = (apps, appTablesMap) => {
   for (let tableName of Object.keys(appTablesMap)) {
       const columnsMap = appTablesMap[tableName]

       for (let columnName of Object.keys(columnsMap)) {
           if (containsDifferences(apps, columnName, columnsMap)) {
               return true
           }
       }
   }
}

const printDifferences = (apps, appTablesMap) => {
    const table = new Table({
        head: ['Table', 'Column', ...apps.map(app => app.name)]
    });

    Object.keys(appTablesMap).sort().forEach(tableName => {
        const columnsMap = appTablesMap[tableName]

        const columns = Object.keys(columnsMap)
            .filter(columnName => containsDifferences(apps, columnName, columnsMap))

        if (columns.length === 0) {
            return
        }

        table.push([
            tableName,
            columns.join('\n'),
            ...apps.map(app => {
                const appColumnOptions = columnName => {
                    const appColumn = columnsMap[columnName][app.name]

                    return appColumn ? appColumn.optionsString : ''
                }

                return columns.map(appColumnOptions).join('\n')
            })
        ])
    })

    console.log(table.toString())
}

module.exports = (apps, options) => {
    const {monitorMode} = options
    const appTablesMap = {}

    const addAppTablesToMap = app => {
        const tablesMapByName = _.keyBy(app.tables, 'name');

        Object.keys(tablesMapByName).forEach(tableName => {
            appTablesMap[tableName] || (appTablesMap[tableName] = {});

            const columnsMap = buildColumnsMap(tablesMapByName[tableName])

            Object.keys(columnsMap).forEach(columnName => {
                appTablesMap[tableName][columnName] || (appTablesMap[tableName][columnName] = {})
                appTablesMap[tableName][columnName][app.name] = columnsMap[columnName]
            })
        })
    }

    apps.forEach(addAppTablesToMap);

    if (monitorMode) {
        hasDifferences(apps, appTablesMap) && process.exit(1)
    } else {
        printDifferences(apps, appTablesMap);
    }
};
