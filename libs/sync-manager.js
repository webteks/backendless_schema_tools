'use strict'

const chalk = require('chalk')
const ask = require('../utils/ask')
const { buildAppTablesMap } = require('./comparator/tables')

const SYSTEM_TABLES = ['DeviceRegistration', 'Loggers']

const errorHandler = (item, err) =>
    console.error(`Error: ${item} - ${err.message}`)

const prompt = q => ask(`${q} (y/n)`)
    .then(answer => answer === 'y')

const removeTableMsg = tableName => `Are you sure you want to delete the table ${chalk.bold(tableName)}?`

const updateColumnMsg = (table, column, source, target) =>
    `Are you sure you want to update the column ${chalk.bold(`${column}.${table}`)}: ` +
    `"${source.optionsString}" => "${target.optionsString}"?`

const removeColumnMsg = (table, column) =>
    `Are you sure you want to delete the column ${chalk.bold(`${table}.${column}`)}?`


module.exports = {
    _syncColumn(appId, tableName, columnName, sourceColumn, targetColumn) {
        const isRelation = !!((sourceColumn && sourceColumn.relationshipType)
            || (targetColumn && targetColumn.relationshipType))
        const columnType = isRelation ? 'relation' : 'column'

        if (!targetColumn) {
            return this.api[columnType].add(appId, tableName, sourceColumn)
        } else if (!sourceColumn) {
            return prompt(removeColumnMsg(tableName, columnName))
                .then(res => res && this.api[columnType].remove(appId, tableName, columnName))
        } else if (targetColumn.optionsString !== sourceColumn.optionsString) {
            return prompt(updateColumnMsg(tableName, columnName, sourceColumn, targetColumn))
                .then(res => res && this.api[columnType].update(appId, tableName, columnName, sourceColumn))
        }

        return Promise.resolve()
    },

    init(api) {

        this.api = {
            table   : {
                add   : api.addTable.bind(api),
                remove: api.removeTable.bind(api)
            },
            column  : {
                add   : api.addColumn.bind(api),
                update: api.updateColumn.bind(api),
                remove: api.removeColumn.bind(api)
            },
            relation: {
                add   : api.addRelation.bind(api),
                update: api.updateRelation.bind(api),
                remove: api.removeRelation.bind(api)
            }
        }
    },

    sync(apps) {
        console.log('Synchronization..')

        return Promise.resolve()
            .then(() => this.syncTables(apps))
            .then(() => this.syncColumns(apps))
            .then(() => console.log('Sync complete'))
    },

    syncTables(apps) {
        console.log('Tables sync..')

        const getTableNames = tables => tables.reduce((tableNames, table) => [...tableNames, table.name], [])

        const [source, ...targets] = apps

        const sourceNames = getTableNames(source.tables).filter(name => !SYSTEM_TABLES.includes(name))

        const addTable = (appId, tableName) =>
            this.api.table.add(appId, tableName).catch(({ response }) => errorHandler(tableName, response.data))
        const removeTable = (appId, tableName) =>
            this.api.table.remove(appId, tableName).catch(({ response }) => errorHandler(tableName, response.data))


        const removeTables = (appId, tablesNames) => {
            return tablesNames.reduce((p, tableName) => {
                return p
                    .then(() => prompt(removeTableMsg(tableName)))
                    .then(res => res && removeTable(appId, tableName))
            }, Promise.resolve())
        }

        return targets.reduce((p, app) => {
            const targetNames = getTableNames(app.tables).filter(name => !SYSTEM_TABLES.includes(name))

            const forAdd = sourceNames.filter(name => !targetNames.includes(name))
            const forRemove = targetNames.filter(name => !sourceNames.includes(name))

            return p
                .then(() => Promise.all(forAdd.map(tableName => addTable(app.id, tableName))))
                .then(() => forRemove.length && removeTables(app.id, forRemove))
        }, Promise.resolve())
    },

    syncColumns(apps) {
        console.log('Columns sync..')

        const appTablesMap = buildAppTablesMap(apps)
        const [sourceApp, ...targetApps] = apps

        return Object.keys(appTablesMap).reduce((p, tableName) => {
            const columnsMap = appTablesMap[tableName]

            if (SYSTEM_TABLES.includes(tableName)) {
                return p
            }

            return Object.keys(columnsMap).reduce((p, columnName) => {
                const sourceColumn = columnsMap[columnName][sourceApp.name]

                return targetApps.reduce((p, app) => {
                    const targetColumn = columnsMap[columnName][app.name]

                    return p.then(() => {

                        return this._syncColumn(app.id, tableName, columnName, sourceColumn, targetColumn)
                            .catch(({ response }) => errorHandler(`${tableName}.${columnName}`, response.data))
                    })
                }, p)
            }, p)
        }, Promise.resolve())
    }
}