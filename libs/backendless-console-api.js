'use strict'

const _ = require('lodash')
const axios = require('axios')
const chalk = require('chalk')
const { promisify } = require('util')

let { readFile, writeFile, stat } = require('fs')

writeFile = promisify(writeFile)
readFile = promisify(readFile)
stat = promisify(stat)

const SYSTEM_COLUMNS = ['created', 'updated', 'ownerId', 'objectId']

const filterLive = apps => apps.filter(app => !app.fromJSON)

const tableColumnsUrl = (appId, table) => `${appId}/console/data/tables/${table}/columns`

const isRelation = column => !!column.relationshipType

class Backendless {
    constructor(username, password, beURL, controlAppName, appNamesToCheck, reportingDir, timeout, verboseOutput) {
        /* Make a list of apps that are contextual to this check */
        const appsContext = _.concat(controlAppName, appNamesToCheck)

        if (!beURL.startsWith('http')) {
            beURL = 'https://' + beURL
        }

        /* Create axios request instance for http calls */
        const instance = axios.create({
            baseURL: beURL,
            timeout: timeout,
            headers: {
                'content-type'    : 'application/json',
                'application-type': 'REST'
            }
        })

        /* Log method and URL for all requests */
        instance.interceptors.request.use(config => {
            if (verboseOutput) {
                console.log(chalk.cyan(`Making ${chalk.bold(config.method.toUpperCase())} request to ${chalk.bold(config.url)}`))
            }

            return config
        })


        /* Log success or failure for all requests on response */
        instance.interceptors.response.use(res => {
            if (verboseOutput) {
                console.log(chalk.bold.green(`...... SUCCESS`))
            }
            return res
        })

        const serverBaseURL = process.env.DEV ? 'http://localhost:9000' : `${beURL}/api`

        /* Assign input vars to object instance */
        _.assign(this, {
            clientBaseURL: beURL,
            serverBaseURL,
            appsContext,
            appList      : [],
            appsToCheck  : [],
            appNamesToCheck,
            controlApp   : {},
            controlAppName,
            instance,
            password,
            reportingDir,
            username,
            verboseOutput
        })
    }

    /* Build app headers given appId and secretKey */
    _getAppHeaders({ appId, secretKey }) {
        return { headers: { 'application-id': appId, 'secret-key': secretKey } }
    }

    /* Build appversion api path provided currentVersionId */
    _getConsoleApiUrl(app) {
        return `${app.id}/console`
    }

    /* Authenticate user & add auth-key to header for future requests */
    login() {
        return this.instance.post('/console/home/login', { 'login': this.username, 'password': this.password })
            .then(res => this.instance.defaults.headers['auth-key'] = res.headers['auth-key'])
    }

    checkIfPath(appName) {
        return stat(appName)
            .then(stats => stats.isFile())
            .catch(() => false)
    }

    getAppFromFile(path) {
        this.verboseOutput && console.log(chalk.cyan(`Loading from file ${chalk.bold(path)}`))

        return readFile(path)
            .then(data => {
                const app = JSON.parse(data)

                app.name = path
                app.fromJSON = true

                this.appList.push(app)
            })
            .then(() => this.verboseOutput && console.log(chalk.bold.green(`...... SUCCESS`)))
            .catch(e => console.log(path, e.message))
    }

    loadFromFileIfNeeded() {
        return Promise.all(this.appsContext.map(appName => {
            return this.checkIfPath(appName)
                .then(isPath => isPath && this.getAppFromFile(appName))
        }))
    }

    getAppList() {
        return this.instance.get('/console/applications')
            .then(({ data: appList }) => this.appList.push(...appList))
    }

    /* Filter application list based on beVersion & which apps are actually needed for checks */
    filterAppList() {
        this.appList = _(this.appList)
            .filter(app => _.includes(this.appsContext, app.name || app.appName))
            .value()
    }

    getAppSecrets() {
        return Promise.all(
            filterLive(this.appList).map(app => {
                if (app.id) {
                    return this.instance.get(`/${app.id}/console/appsettings`)
                        .then(({ data }) => app.secretKey = data.devices.REST)
                }
            })
        )
    }

    getAppDataTables() {
        console.log('Fetching schema..')

        const normalizeTable = table => {
            table.columns = table.columns.filter(column => !SYSTEM_COLUMNS.includes(column.name))

            return table
        }

        return Promise.all(
            filterLive(this.appList).map(app => {
                return this.instance.get(`${this._getConsoleApiUrl(app)}/data/tables`)
                    .then(({ data }) => app.tables = _.sortBy(data.tables, 'name').map(normalizeTable))
            })
        )
    }

    getRoles(appId) {
        return this.instance.get(`${appId}/console/security/roles`)
    }

    getAppRoles() {
        console.log('Fetching roles..')

        return Promise.all(
            filterLive(this.appList).map(app => {
                return this.getRoles(app.id).then(({ data }) => app.roles = data)
            })
        )
    }

    getAppRolePermissions() {
        console.log('Fetching roles global permissions..')

        return Promise.all(
            filterLive(this.appList).map(app => Promise.all(
                app.roles.map(role => {
                    return this.instance.get(`${this._getConsoleApiUrl(app)}/security/roles/permissions/${role.roleId}`)
                        .then(({ data }) => role.permissions = data)
                })
            ))
        )
    }

    getAppDataTableUserPermissions() {
        console.log('Fetching users Data API permissions..')

        return Promise.all(
            filterLive(this.appList).map(app => {
                return Promise.all(
                    app.tables.map(table => {
                        return this.instance.get(`${this._getConsoleApiUrl(app)}/security/data/${table.tableId}/users`)
                            .then(({ data }) => table.users = data.data)
                    })
                )
            })
        )
    }

    getAppDataTableRolePermissions() {
        console.log('Fetching roles Data API permissions..')

        return Promise.all(
            filterLive(this.appList).map(app => Promise.all(
                app.tables.map(table => {

                    return this.instance.get(`${this._getConsoleApiUrl(app)}/security/data/${table.tableId}/roles`)
                        .then(({ data }) => table.roles = data)
                }))
            )
        )
    }

    getAppServices() {
        console.log('Fetching API Services..')

        return Promise.all(
            filterLive(this.appList).map(async app => {

                return this.instance.get(this._getConsoleApiUrl(app) + '/localservices').then(({ data: services }) => {
                    app.services = services

                    return Promise.all(services.map(service => {
                        return this.instance.get(`${this._getConsoleApiUrl(app)}/localservices/${service.id}/methods`)
                            .then(({ data: methods }) => service.methods = methods)
                    }))
                })
            })
        )
    }

    getAppServicesRolePermissions() {
        console.log('Fetching roles Services API permissions..')

        return Promise.all(
            filterLive(this.appList).map(async (app, appIndex) => {
                return Promise.all(app.services.map(service => {
                    const methodsMap = _.keyBy(service.methods, 'id')

                    return this.instance.get(
                        `${this._getConsoleApiUrl(app)}/security/localservices/${service.id}/roles?pageSize=50`)
                        .then(({ data }) => {
                            // endpoint permission sync requires roles list
                            if (appIndex > 0) {
                                service.roles = data
                            }

                            data.forEach(role => {
                                role.permissions.forEach(({ operation, access }) => {
                                    const method = methodsMap[operation]

                                    method.roles = method.roles || {}
                                    method.roles[role.name] = access
                                })
                            })
                        })
                }))
            })
        )
    }

    /* Get main app meta data and return */
    getAppMeta() {
        return this.login()
            .then(() => this.loadFromFileIfNeeded())
            .then(() => this.getAppList())
            .then(() => this.getAppSecrets())
            .then(() => this.filterAppList())
            .then(() => this.normalize())
    }

    normalize() {
        this.appList.forEach(app => {
            app.name = app.name || app.appName
            app.id = app.id || app.appId

            delete app.appName
            delete app.appId
        })
    }

    /* Set controlApp & appsToCheck from appList and return copy of data */
    getApps() {
        const findAppByName = appName => _.find(this.appList, { 'name': appName })
        const controlApp = findAppByName(this.controlAppName)

        if (!controlApp) {
            throw new Error(`${this.controlAppName} app does not exist`)
        }

        const appsToCheck = this.appNamesToCheck.map(appName => {
            const app = findAppByName(appName)

            if (!app) {
                throw new Error(`${appName} app does not exist`)
            }

            return app
        })

        return [controlApp, ...appsToCheck]
    }

    addTable(appId, name) {
        return this.instance.post(`${appId}/console/data/tables`, { name })
    }

    removeTable(appId, name) {
        return this.instance.delete(`${appId}/console/data/tables/${name}`)
    }

    addColumn(appId, table, column) {
        let path = tableColumnsUrl(appId, table)

        if (isRelation(column)) {
            path += '/relation'
        }

        return this.instance.post(path, column)
    }

    updateColumn(appId, table, column) {
        const columnName = column.name || column.columnName
        let path = tableColumnsUrl(appId, table)

        if (isRelation(column)) {
            path += '/relation'
        }

        return this.instance.put(`${path}/${columnName}`, column)

    }

    removeColumn(appId, table, column) {
        const columnName = column.name || column.columnName
        let path = tableColumnsUrl(appId, table)

        if (isRelation(column)) {
            path += '/relation'
        }

        return this.instance.delete(`${path}/${columnName}`)
    }

    addSecurityRole(appId, roleName) {
        return this.instance.put(`${appId}/console/security/roles/${roleName}`, {})
    }

    updateSecurityRole(appId, roleId, premission) {
        return this.instance.put(`${appId}/console/security/roles/permissions/${roleId}`, premission)
    }

    removeSecurityRole(appId, roleId) {
        return this.instance.delete(`${appId}/console/security/roles/${roleId}`)
    }

    updateTablePermissions(appId, tableId, roleId, premissions) {
        return this.instance.put(`${appId}/console/security/data/${tableId}/roles/${roleId}`, premissions)
    }

    resetTablePermissions(appId, tableId, roleId) {
        return this.instance.delete(`${appId}/console/security/data/${tableId}/roles/${roleId}`)
    }

    updateEndpointPermissions(appId, serviceId, roleId, premissions) {
        return this.instance.put(`${appId}/console/security/localservices/${serviceId}/roles/${roleId}`, premissions)
    }

    resetEndpointPermissions(appId, serviceId, roleId, operation) {
        return this.instance.delete(`${appId}/console/security/localservices/${serviceId}/roles/${roleId}/${operation}`)
    }

    createRecord(appId, table, record) {
        return this.instance.post(`${appId}/console/data/${table}`, record)
    }

    deleteRecord(appId, table, record) {
        return this.instance.delete(`${appId}/console/data/tables/${table}/records`, { data: [record] })
    }

    updateAssignedUserRoles(appId, users, roles) {
        return this.instance.put(`${appId}/console/security/assignedroles`, { users, roles })
    }

    static dump(app, path, verbose) {
        const { ridOfIds, saveDataToFile } = Backendless

        return saveDataToFile(ridOfIds(app), path, verbose)
    }

    static ridOfIds(app) {
        const removeId = item => delete item.id
        const removeRoleId = role => delete role.roleId
        const removeColumnId = column => delete column.columnId
        const removeRelationId = relation => {
            delete relation.columnId
            delete relation.fromTableId
            delete relation.toTableId
        }

        app.tables.forEach(table => {
            delete table.tableId;

            (table.columns || []).forEach(removeColumnId);
            (table.relations || []).forEach(removeRelationId);
            (table.geoRelations || []).forEach(removeRelationId);
            (table.roles || []).forEach(removeRoleId)
        })

        app.roles.forEach(removeRoleId)

        app.services.forEach(service => {
            removeId(service)
            service.methods.forEach(removeId)
        })

        return app
    }

    static saveDataToFile(data, path, verbose) {
        return writeFile(path, JSON.stringify(data, null, 2))
            .then(() => verbose && console.log(chalk.bold.green(`...... Schema is saved`)))
            .catch(e => console.error(e))
    }
}

module.exports = Backendless
