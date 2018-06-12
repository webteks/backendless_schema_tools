'use strict'

const chalk = require('chalk')

const { buildAppTablesMap } = require('../comparator/tables')
const { cleanup, bulkUpdate, prompt } = require('./helpers')

const SYSTEM_TABLES = ['DeviceRegistration', 'Loggers']

const log = console.log

const removeTableMsg = (app, table) => `Are you sure you want to delete the table ${chalk.bold(`${app}.${table}`)}?`

const updateColumnMsg = (app, table, column, source, target) =>
    `Are you sure you want to update the column ${chalk.bold(`${app}.${table}.${column}`)}: ` +
    `"${source.optionsString}" => "${target.optionsString}"?`

const removeColumnMsg = (app, table, column) =>
    `Are you sure you want to delete the column ${chalk.bold(`${app}.${table}.${column}`)}?`

const errorHandler = (item, err) => {
    if (err.response) {
        err = err.response.data
    }

    console.error(`Error: ${item} - ${err.message}`, err)
}

const syncTables = (api, apps) => {
    log('Schema sync..')

    const getTableNames = tables =>
        tables
            .map(table => table.name)
            .filter(name => !SYSTEM_TABLES.includes(name))

    const [source, ...targets] = apps

    const sourceNames = getTableNames(source.tables)

    const addTable = (appId, tableName) =>
        api.addTable(appId, tableName).catch(err => errorHandler(tableName, err))
    const removeTable = (appId, tableName) =>
        api.removeTable(appId, tableName).catch(err => errorHandler(tableName, err))


    const removeTables = (app, tablesNames) => {
        return tablesNames.reduce((p, tableName) => {
            return p
                .then(() => prompt(removeTableMsg(app.name, tableName)))
                .then(res => res && removeTable(app.id, tableName))
                .then(() => app.tables = app.tables.filter(table => table.name !== tableName))
        }, Promise.resolve())
    }

    return targets.reduce((p, app) => {
        const targetNames = getTableNames(app.tables)

        const forAdd = sourceNames.filter(name => !targetNames.includes(name))
        const forRemove = targetNames.filter(name => !sourceNames.includes(name))

        return p
            .then(() => forRemove.length && removeTables(app, forRemove))
            .then(() => Promise.all(forAdd.map(tableName => addTable(app.id, tableName))))
    }, Promise.resolve())
}

const syncColumn = async (api, app, tableName, columnName, sourceColumn, targetColumn) => {

    const addColumn = () => api.addColumn(app.id, tableName, sourceColumn)

    const updateColumn = async () =>
        prompt(updateColumnMsg(app.name, tableName, columnName, sourceColumn, targetColumn))
            .then(async res => {
                if (!res) return

                if (sourceColumn.defaultValue && sourceColumn.required) {
                    const where = `${columnName} is null`

                    await bulkUpdate(api, app, tableName, where, { [columnName]: sourceColumn.defaultValue })
                }

                return api.updateColumn(app.id, tableName, sourceColumn)
            })

    const removeColumn = () =>
        prompt(removeColumnMsg(app.name, tableName, columnName))
            .then(res => res && api.removeColumn(app.id, tableName, targetColumn))

    if (sourceColumn && !targetColumn) {
        return addColumn()
    } else if (!sourceColumn && targetColumn) {
        return removeColumn()
    } else if (sourceColumn && targetColumn && targetColumn.optionsString !== sourceColumn.optionsString) {
        return updateColumn()
    }

    return Promise.resolve()
}

const syncColumns = (api, apps) => {
    const appTablesMap = buildAppTablesMap(apps)
    const [sourceApp, ...targetApps] = apps

    return Object.keys(appTablesMap)
        .filter(tableName => !SYSTEM_TABLES.includes(tableName))
        .reduce((promise, tableName) => {
            const columnsMap = appTablesMap[tableName]

            Object.keys(columnsMap).forEach(columnName => {
                const sourceColumn = columnsMap[columnName][sourceApp.name]

                targetApps.forEach(app => {
                    const targetColumn = columnsMap[columnName][app.name]

                    promise = promise.then(() =>
                        syncColumn(api, app, tableName, columnName, sourceColumn, targetColumn)
                            .catch(err => errorHandler(`${tableName}.${columnName}`, err)))
                })
            })

            return promise
        }, Promise.resolve())
}


module.exports = (api, apps) =>
    Promise.resolve()
        .then(() => syncTables(api, apps))
        // update table data
        .then(() => api.getAppDataTables())
        .then(() => syncColumns(api, apps))
        .then(() => cleanup(api, apps))