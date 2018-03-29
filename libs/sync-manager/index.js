'use strict'

const assert = require('assert')
const chalk = require('chalk')
const _ = require('lodash')
const request = require('axios')

const ask = require('../../utils/ask')
const { buildAppTablesMap } = require('../comparator/tables')
const syncAppPermissions = require('./app-permissions')
const syncTablesPermissions = require('./tables-permissions')
const syncEndpointsPermissions = require('./endpoints-permissions')

const { SCHEMA, API, TABLE_PERMS, ROLE_PERMS, API_PERMS } = require('../../constants/command-options').CheckList


const log = console.log

const SYSTEM_TABLES = ['DeviceRegistration', 'Loggers']

const ADMIN_EMAIL = 'tempadmin@admin.admin'
const ADMIN_PASSWORD = 'droneup2018'
const ADMIN_ROLE = 'DARTadmin'

let SERVER_URL

const errorHandler = (item, err) => {
    if (err.response) {
        err = err.response.data
    }

    console.error(`Error: ${item} - ${err.message}`, err)
}

const prompt = q => ask(`${q} (y/n)`)
    .then(answer => answer === 'y')

const removeTableMsg = tableName => `Are you sure you want to delete the table ${chalk.bold(tableName)}?`

const updateColumnMsg = (table, column, source, target) =>
    `Are you sure you want to update the column ${chalk.bold(`${table}.${column}`)}: ` +
    `"${source.optionsString}" => "${target.optionsString}"?`

const removeColumnMsg = (table, column) =>
    `Are you sure you want to delete the column ${chalk.bold(`${table}.${column}`)}?`


const createRecord = (req, appId, table, record) =>
    req.post(`${appId}/console/data/${table}`, record)

const deleteRecord = (req, appId, table, record) =>
    req.delete(`${appId}/console/data/tables/${table}/records`, { data: [record] })

const userCache = {}

const createAdmin = async (req, app) => {
    let user

    const createUser = (req, appId, user) =>
        createRecord(req, appId, 'Users', user)

    const getRoles = appId =>
        req.get(`${appId}/console/security/roles`)

    const getRoleId = async (appId, name) => {
        const role = await getRoles(appId)
            .then(({ data: roles }) => roles.find(role => role.rolename === name))

        assert(role, `${name} role doesn't exist`)

        return role.roleId
    }

    const updateAssignedUserRoles = (appId, users, roles) =>
        req.put(`${appId}/console/security/assignedroles`, { users, roles })

    try {
        user = await createUser(req, app.id, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
            .then(({ data }) => data)

        await updateAssignedUserRoles(app.id, [user.objectId], [{
            roleId: await getRoleId(app.id, ADMIN_ROLE),
            status: 'ALL'
        }])

        userCache[app.id] = user
    } catch (e) {
        if (e.response.data.message.match('User already exists.')) {
            userCache[app.id] = {}

            return userCache[app.id]
        }

        throw new Error(e)
    }

    return user
}

const loginAdmin = async (req, app) => {
    const { data: user } = await request.post(`${SERVER_URL}/${app.id}/${app.secretKey}/users/login`, {
        login   : ADMIN_EMAIL,
        password: ADMIN_PASSWORD
    })

    userCache[app.id] = user

    return userCache[app.id]
}

const cleanup = (req, apps) => Promise.all(
    apps.map(app => userCache[app.id] && deleteRecord(req, app.id, 'Users', userCache[app.id]))
)

const bulkUpdate = async (req, app, table, where, data) => {
    let user = userCache[app.id]

    if (!user) {
        user = await createAdmin(req, app)
    }

    if (!user['user-token']) {
        await loginAdmin(req, app)
    }

    return request.put(`${SERVER_URL}/${app.id}/${app.secretKey}/data/bulk/${table}?where=${where}`, data, {
        headers: { 'user-token': userCache[app.id]['user-token'] },
        data
    })
}

module.exports = (api, syncList) => {
    const request = api.instance

    SERVER_URL = api.serverBaseURL

    return {
        async _syncColumn(app, tableName, columnName, sourceColumn, targetColumn) {

            const addColumn = () => api.addColumn(app.id, tableName, sourceColumn)

            const updateColumn = async () =>
                prompt(updateColumnMsg(tableName, columnName, sourceColumn, targetColumn))
                    .then(async res => {
                        if (!res) return

                        if (sourceColumn.defaultValue && sourceColumn.required) {
                            await bulkUpdate(request, app, tableName, `${columnName} is null`, {
                                [columnName]: sourceColumn.defaultValue
                            })
                        }

                        return api.updateColumn(app.id, tableName, sourceColumn)
                    })

            const removeColumn = () =>
                prompt(removeColumnMsg(tableName, columnName))
                    .then(res => res && api.removeColumn(app.id, tableName, targetColumn))

            if (!targetColumn) {
                return addColumn()
            } else if (!sourceColumn) {
                return removeColumn()
            } else if (targetColumn.optionsString !== sourceColumn.optionsString) {
                return updateColumn()
            }

            return Promise.resolve()
        },


        destroy(apps) {
            return cleanup(request, apps)
        },

        sync(apps) {
            if (!(syncList[SCHEMA] || syncList[ROLE_PERMS] || syncList[TABLE_PERMS] || syncList[API_PERMS])) {
                return
            }

            console.log('Synchronization..')

            return Promise.resolve()
                .then(() => syncList[SCHEMA] && this.syncSchema(apps))
                .then(() => syncList[ROLE_PERMS] && syncAppPermissions(api, apps))
                // update table roles
                .then(() => syncList[ROLE_PERMS] && syncList[TABLE_PERMS] && api.getAppDataTableRolePermissions())

                .then(() => syncList[TABLE_PERMS] && syncTablesPermissions(api, apps))
                .then(() => syncList[API_PERMS] && syncEndpointsPermissions(api, apps))
                .then(() => this.destroy(apps.slice(1)))
                .then(() => console.log('Sync complete'))
        },

        syncSchema(apps) {
            return Promise.resolve()
                .then(() => this.syncTables(apps))
                // update table data
                .then(() => api.getAppDataTables())

                .then(() => this.syncColumns(apps))
        },

        syncTables(apps) {
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
            const appTablesMap = buildAppTablesMap(apps)
            const [sourceApp, ...targetApps] = apps

            return Object.keys(appTablesMap)
                .filter(tableName => !SYSTEM_TABLES.includes(tableName))
                .reduce((promise, tableName) => {
                    const columnsMap = appTablesMap[tableName]


                    Object.keys(columnsMap).forEach(columnName => {
                        const sourceColumn = columnsMap[columnName][sourceApp.name]

                        return targetApps.forEach(app => {
                            const targetColumn = columnsMap[columnName][app.name]

                            promise = promise.then(() =>
                                this._syncColumn(app, tableName, columnName, sourceColumn, targetColumn)
                                    .catch(err => errorHandler(`${tableName}.${columnName}`, err)))
                        })
                    })

                    return promise
                }, Promise.resolve())
        }
    }
}