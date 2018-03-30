'use strict'

const syncTables = require('./tables')
const syncAppPermissions = require('./app-permissions')
const syncTablesPermissions = require('./tables-permissions')
const syncEndpointsPermissions = require('./endpoints-permissions')

const { SCHEMA, TABLE_PERMS, ROLE_PERMS, API_PERMS } = require('../../constants/command-options').CheckList


module.exports = (api, apps, syncList) => {
    if (!(syncList[SCHEMA] || syncList[ROLE_PERMS] || syncList[TABLE_PERMS] || syncList[API_PERMS])) {
        return
    }

    console.log('Synchronization..')

    return Promise.resolve()
        .then(() => syncList[SCHEMA] && syncTables(api, apps))
        .then(() => syncList[ROLE_PERMS] && syncAppPermissions(api, apps))
        // update table roles
        .then(() => syncList[ROLE_PERMS] && syncList[TABLE_PERMS] && api.getAppDataTableRolePermissions())

        .then(() => syncList[TABLE_PERMS] && syncTablesPermissions(api, apps))
        .then(() => syncList[API_PERMS] && syncEndpointsPermissions(api, apps))
        .then(() => console.log('Sync complete'))

}