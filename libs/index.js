'use strict'

const BackendlessConsole = require('../libs/backendless-console-api.js')

const util = require('util')
const compareTables = require('../libs/comparator/tables')
const compareTablesPermissions = require('../libs/comparator/tables-permissions')
const compareEndpoints = require('../libs/comparator/endpoints')
const compareEndpointsPermissions = require('../libs/comparator/endpoints-permissions')
const compareAppPermissions = require('../libs/comparator/app-permissions')
const sync = require('../libs/sync')

const {SCHEMA, API, TABLE_PERMS, ROLE_PERMS, API_PERMS} = require('./constants/command-options').CheckList

module.exports = options => {

    const checkList = options.checkList.reduce((o, key) => {
        o[key] = true
        return o
    }, {})

    const {
        username, password, appControl, appsToCheck, dumpPath, reportingDir, beURL,
        timeout, verboseOutput, silent, monitorMode, syncMode
    } = options

    const backendless = new BackendlessConsole(
        username, password, beURL, appControl, appsToCheck, reportingDir, timeout, verboseOutput)

    let apps

    const getAppRoles = () =>
        Promise.resolve()
            .then(() => backendless.getAppRoles())
            .then(() => backendless.getAppRolePermissions())

    return backendless.getAppMeta()
        .then(() => (checkList[SCHEMA] || checkList[TABLE_PERMS]) && backendless.getAppDataTables())
        .then(() => (checkList[ROLE_PERMS] || checkList[API_PERMS]) && getAppRoles())
        // .then(() => backendless.getAppDataTableUserPermissions())
        .then(() => checkList[TABLE_PERMS] && backendless.getAppDataTableRolePermissions())
        .then(() => (checkList[API] || checkList[API_PERMS]) && backendless.getAppServices())
        .then(() => checkList[API_PERMS] && backendless.getAppServicesRolePermissions())
        .then(() => apps = backendless.getApps())
        .then(() => dumpPath && BackendlessConsole.dump(apps[0], dumpPath, verboseOutput))
        .then(() => {
            if (apps.length > 1) {
                return Promise.resolve()
                    .then(() => checkList[SCHEMA] && compareTables(apps))
                    .then(hasDiferences => (checkList[ROLE_PERMS] && compareAppPermissions(apps)) || hasDiferences)
                    .then(hasDiferences => (checkList[TABLE_PERMS] && compareTablesPermissions(apps)) || hasDiferences)
                    .then(hasDiferences => (checkList[API] && compareEndpoints(apps)) || hasDiferences)
                    .then(hasDiferences => (checkList[API_PERMS] && compareEndpointsPermissions(apps)) || hasDiferences)
                    .then(hasDiferences => {
                        if (hasDiferences && syncMode) {
                            return sync(backendless, apps, {syncList: checkList, silent})
                                .then(() => hasDiferences)
                        }

                        return hasDiferences
                    })
                    .then(hasDiferences => {
                        if (hasDiferences && monitorMode) {
                            throw new Error('Differences detected')
                        }
                    })
            }
        })
        .catch(err => {
            console.log(util.inspect(err))
            console.log(chalk.bold.red(err))

            throw err
        })
}