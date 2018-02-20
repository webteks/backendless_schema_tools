const _ = require('lodash');
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

const printDifferences = (apps, appTablesMap) => {
    const table = new Table({
        head: ['Table', 'Column', ...apps.map(app => app.name)]
    });

    let result = false;

    Object.keys(appTablesMap).sort().forEach(tableName => {
        const columnsMap = appTablesMap[tableName]

        const columns = Object.keys(columnsMap)
            .filter(columnName => containsDifferences(apps, columnName, columnsMap))

        if (columns.length === 0) {
            return
        }

        result = true;

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

    if (result) {
        console.log('\nTable schema:')
        console.log(table.toString())
    }

    return result;
}

module.exports = apps => {
    const appTablesMap = {}

    apps.forEach(app => {
        const tablesMapByName = _.keyBy(app.tables, 'name');

        Object.keys(tablesMapByName).forEach(tableName => {
            appTablesMap[tableName] || (appTablesMap[tableName] = {});

            const columnsMap = buildColumnsMap(tablesMapByName[tableName])

            Object.keys(columnsMap).forEach(columnName => {
                appTablesMap[tableName][columnName] || (appTablesMap[tableName][columnName] = {})
                appTablesMap[tableName][columnName][app.name] = columnsMap[columnName]
            })
        })
    });

    return printDifferences(apps, appTablesMap);
};