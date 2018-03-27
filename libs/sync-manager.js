'use strict'

const assert = require('assert')
const chalk = require('chalk')
const _ = require('lodash')
const request = require('axios')

const ask = require('../utils/ask')
const { buildAppTablesMap } = require('./comparator/tables')
const { buildAppRolesMap, containsDifferences } = require('./comparator/app-permissions')
const { SCHEMA, API, TABLE_PERMS, ROLE_PERMS, API_PERMS } = require('../constants/command-options').CheckList


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

const removeRoleMsg = role =>
    `Are you sure you want to delete the role ${chalk.bold(`${role}`)}?`


const createRecord = (req, appId, table, record) =>
    req.post(`${appId}/console/data/${table}`, record)

const deleteRecord = (req, appId, table, record) =>
    req.delete(`${appId}/console/data/tables/${table}/records`, { data: [record] })

const userCache = {}

const createAdmin = async (req, app) => {
    let user

    const createUser = (req, appId, user) =>
        createRecord(req, appId, 'Users', user)

    const getRoles = (req, appId) =>
        req.get(`${appId}/console/security/roles`)

    const getRoleId = async (req, appId, name) => {
        const role = await getRoles(req, appId)
            .then(({data: roles}) => roles.find(role => role.rolename === name))

        assert(role, `${name} role doesn't exist`)

        return role.roleId
    }

    const updateAssignedUserRoles = (req, appId, users, roles) =>
        req.put(`${appId}/console/security/assignedroles`, { users, roles })

    try {
        user = await createUser(req, app.id, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
            .then(({data}) => data)

        await updateAssignedUserRoles(req, app.id, [user.objectId], [{
            roleId: await getRoleId(req, app.id, ADMIN_ROLE),
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

    const {data: user} = await request.post(`${SERVER_URL}/${app.id}/${app.secretKey}/users/login`, {
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


module.exports = {
    async _syncColumn(app, tableName, columnName, sourceColumn, targetColumn) {

        const addColumn = () => this.api.addColumn(app.id, tableName, sourceColumn)

        const updateColumn = async () =>
            prompt(updateColumnMsg(tableName, columnName, sourceColumn, targetColumn))
                .then(async res => {
                    if (!res) return

                    if (sourceColumn.defaultValue && sourceColumn.required) {
                        await bulkUpdate(this.request, app, tableName, `${columnName} is null`, {
                            [columnName]: sourceColumn.defaultValue
                        })
                    }

                    return this.api.updateColumn(app.id, tableName, sourceColumn)
                })

        const removeColumn = () =>
            prompt(removeColumnMsg(tableName, columnName))
                .then(res => res && this.api.removeColumn(app.id, tableName, targetColumn))

        if (!targetColumn) {
            return addColumn()
        } else if (!sourceColumn) {
            return removeColumn()
        } else if (targetColumn.optionsString !== sourceColumn.optionsString) {
            return updateColumn()
        }

        return Promise.resolve()
    },

    init(api) {
        this.api = api
        this.request = api.instance

        SERVER_URL = api.serverBaseURL

        return this
    },

    destroy(apps) {
        return cleanup(this.request, apps)
    },

    sync(apps, syncList) {
        if (!syncList[SCHEMA] && !syncList[ROLE_PERMS]) {
            return
        }

        console.log('Synchronization..')

        return Promise.resolve()
            .then(() => syncList[SCHEMA] && this.syncSchema(apps))
            .then(() => syncList[ROLE_PERMS] && this.syncAppRoles(apps))
            .then(() => this.destroy(apps.slice(1)))
            .then(() => console.log('Sync complete'))
    },

    syncSchema(apps) {
        return Promise.resolve()
            .then(() => this.syncTables(apps))
            // update data
            .then(() => this.api.getAppDataTables())
            .then(() => this.syncColumns(apps))
    },

    syncAppRoles(apps) {
        return Promise.resolve()
            .then(() => this.syncRoles(apps))
            .then(() => this.syncRolesPermissions(apps))
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
            this.api.addTable(appId, tableName).catch(err => errorHandler(tableName, err))
        const removeTable = (appId, tableName) =>
            this.api.removeTable(appId, tableName).catch(err => errorHandler(tableName, err))


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

                        return this._syncColumn(app, tableName, columnName, sourceColumn, targetColumn)
                            .catch(err => errorHandler(`${tableName}.${columnName}`, err))
                    })
                }, p)
            }, p)
        }, Promise.resolve())
    },

    syncRoles(apps) {
        log('Roles sync..')

        const [sourceApp, ...targetApps] = apps

        const addRole = (app, rolename) =>
            this.api.addSecurityRole(app.id, rolename)
                .then(({data: role}) => app.roles.push(role))

        const removeRole = (app, roleId, rolename) =>
            prompt(removeRoleMsg(rolename)).then(res =>
                res && this.api.removeSecurityRole(app.id, roleId)
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
        log('Roles permissions sync..')

        const appRolesMap = buildAppRolesMap(apps)
        const [sourceApp, ...targetApps] = apps

        return Promise.all(Object.keys(appRolesMap).map(opKey => {
            const rolesMap = appRolesMap[opKey]
            const [type, operation] = opKey.split('.')

            const roles = Object.keys(rolesMap).filter(roleName => containsDifferences(apps, roleName, rolesMap))

            return Promise.all(targetApps.map(app => {
                return Promise.all(roles.map(roleName => {
                    const { roleId } = app.roles.find(role => role.rolename === roleName)

                    return this.api.updateSecurityRole(app.id, roleId, {
                        type,
                        operation,
                        access: rolesMap[roleName][sourceApp.name]
                    })
                }))
            }))
        }))
    }
}