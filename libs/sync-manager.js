'use strict'

const chalk = require('chalk')
const _ = require('lodash')
const ask = require('../utils/ask')
const { buildAppTablesMap } = require('./comparator/tables')
const { buildAppRolesMap, containsDifferences } = require('./comparator/app-permissions')
const { SCHEMA, API, TABLE_PERMS, ROLE_PERMS, API_PERMS } = require('../constants/command-options').CheckList



const SYSTEM_TABLES = ['DeviceRegistration', 'Loggers']

const errorHandler = (item, err) =>
    console.error(`Error: ${item} - ${err.message}`)

const prompt = q => ask(`${q} (y/n)`)
    .then(answer => answer === 'y')

const removeTableMsg = tableName => `Are you sure you want to delete the table ${chalk.bold(tableName)}?`

const updateColumnMsg = (table, column, source, target) =>
    `Are you sure you want to update the column ${chalk.bold(`${table}.${column}`)}: ` +
    `"${source.optionsString}" => "${target.optionsString}"?`

const removeColumnMsg = (table, column) =>
    `Are you sure you want to delete the column ${chalk.bold(`${table}.${column}`)}?`

const removeRoleMsg = role =>
    `Are you sure you want to delete the role ${chalk.bold(`${role}`)}?`


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
            },
            role    : {
                add   : api.addSecurityRole.bind(api),
                remove: api.removeSecurityRole.bind(api),
                update: api.updateSecurityRole.bind(api)
            }
        }
    },

    sync(apps, checkList) {
        if (!checkList[SCHEMA] && !checkList[ROLE_PERMS]) {
            return
        }

        console.log('Synchronization..')

        return Promise.resolve()
            .then(() => checkList[SCHEMA] && this.syncSchema(apps))
            .then(() => checkList[ROLE_PERMS] && this.syncAppRoles(apps))
            .then(() => console.log('Sync complete'))
    },

    syncSchema(apps) {
        return Promise.resolve()
            .then(() => this.syncTables(apps))
            .then(() => this.syncColumns(apps))
    },

    syncAppRoles(apps) {
        return Promise.resolve()
            .then(() => this.syncRoles(apps))
            .then(() => this.syncRolesPermissions(apps))
    },

    syncTables(apps) {
        console.log('Tables sync..')

        const getTableNames = tables =>
            tables
                .map(table => table.name)
                .filter(name => !SYSTEM_TABLES.includes(name))

        const [source, ...targets] = apps

        const sourceNames = getTableNames(source.tables)

        const addTable = (appId, tableName) =>
            this.api.table.add(appId, tableName).catch(({ response }) => errorHandler(tableName, response.data))
        const removeTable = (appId, tableName) =>
            this.api.table.remove(appId, tableName).catch(({ response }) => errorHandler(tableName, response.data))


        const removeTables = (app, tablesNames) => {
            return tablesNames.reduce((p, tableName) => {
                return p
                    .then(() => prompt(removeTableMsg(tableName)))
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
    },

    syncRoles(apps) {
        console.log('Roles sync..')

        const [sourceApp, ...targetApps] = apps

        const addRole = (app, rolename) =>
            this.api.role.add(app.id, rolename)
                .then(({ data }) => app.roles.push(data))

        const removeRole = (app, roleId, rolename) =>
            prompt(removeRoleMsg(rolename)).then(res =>
                res && this.api.role.remove(app.id, roleId)
                    .then(() => app.roles = app.roles.filter(role => role.roleId !== roleId)))

        return Promise.all(targetApps.map(targetApp => {

            const forAdd = sourceApp.roles.filter(({ rolename }) => !_.find(targetApp.roles, { rolename }))
            const forRemove = targetApp.roles.filter(({ rolename }) => !_.find(sourceApp.roles, { rolename }))

            return Promise.all([
                ...forAdd.map(({ rolename }) => addRole(targetApp, rolename)),
                ...forRemove.map(({ roleId, rolename }) => removeRole(targetApp, roleId, rolename))
            ])
        }))
    },

    syncRolesPermissions(apps) {
        console.log('Roles permissions sync..')

        const appRolesMap = buildAppRolesMap(apps)
        const [sourceApp, ...targetApps] = apps


        return Promise.all(Object.keys(appRolesMap).map(opKey => {
            const rolesMap = appRolesMap[opKey]
            const [type, operation] = opKey.split('.')

            const roles = Object.keys(rolesMap).filter(roleName => containsDifferences(apps, roleName, rolesMap))

            return Promise.all(targetApps.map(app => {
                return Promise.all(roles.map(roleName => {
                    const { roleId } = app.roles.find(role => role.rolename === roleName)

                    return this.api.role.update(app.id, roleId, {
                        type,
                        operation,
                        access: rolesMap[roleName][sourceApp.name]
                    })
                }))
            }))
        }))
    }
}