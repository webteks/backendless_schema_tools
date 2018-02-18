const _ = require('lodash')
const axios = require('axios')
const chalk = require('chalk')
const Promise = require('bluebird')
const { promisify } = require('util')
let { readFile, writeFile, stat } = require('fs')

writeFile = promisify(writeFile)
readFile = promisify(readFile)
stat = promisify(stat)

const SYSTEM_COLUMNS = ['created', 'updated', 'ownerId', 'objectId']


class Backendless {
    constructor(username, password, beURL, controlAppName, appNamesToCheck, reportingDir, timeout, verboseOutput) {
        /* Make a list of apps that are contextual to this check */
        const appsContext = _.concat(controlAppName, appNamesToCheck)


        /* Create axios request instance for http calls */
        const instance = axios.create({
            baseURL: 'https://' + beURL,
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

        /* Assign input vars to object instance */
        _.assign(this, {
            appsContext,
            appList    : [],
            appsToCheck: [],
            appNamesToCheck,
            controlApp : {},
            controlAppName,
            instance,
            password,
            reportingDir,
            username,
            verboseOutput
        })
    }

    /* Find app in appList */
    _findAppByName(appName) {
        return _.find(this.appList, {'name': appName});
    }

    /* Build app headers given appId and secretKey */
    _getAppHeaders({ appId, secretKey }) {
        return { headers: { 'application-id': appId, 'secret-key': secretKey } }
    }

    /* Build appversion api path provided currentVersionId */
    _getAppVersionPath({id}) {
        return `${id}/console`
    };

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

    /* Get application from dump-file */
    getApp(path) {
        this.verboseOutput && console.log(chalk.cyan(`Loading from file ${chalk.bold(path)}`))

        return readFile(path)
            .then(data => {
                const app = JSON.parse(data)

                app.name = path
                this.appList.push(app)
            })
            .then(() => this.verboseOutput && console.log(chalk.bold.green(`...... SUCCESS`)))
            .catch(e => console.log(path, e.message))
    }

    loadFromFileIfNeeded() {
        return Promise.all(this.appsContext.map(appName => {
            return this.checkIfPath(appName)
                .then(isPath => isPath && this.getApp(appName))
        }))
    }

    /* Get application list */
    getAppList() {
        return this.instance.get('/console/applications')
            .then(({ data: appList }) => this.appList.push(...appList))
    }

    /* Filter application list based on beVersion & which apps are actually needed for checks */
    filterAppList() {
        this.appList = _(this.appList)
            .filter(app => _.includes(this.appsContext, app.name))
            .value();

        return;
    }

    /* Get app version ids. Regardless of appId used all apps are returned. */
    getAppVersions() {
        const appId = this.appList[0].id
        return this.instance.get(`/console/${appId}/versions`)
            .then(({ data: appVersions }) => {
                this.appList = _.map(this.appList, app => _.assign(app, _.find(appVersions, { 'id': app.id })))
            })
    }

    /* Get app secrets */
    getAppSecrets() {
        return Promise.all(
            _.map(this.appList, (app, i) => {
                if (!app.id) return

                return this.instance.get(`/${app.id}/console/appsettings`)
                    .then(({data}) => this.appList[i].secretKey = data.devices.REST);
            })
        )
    }

    /* Get app data tables */
    getAppDataTables() {
        return Promise.all(
            _.map(this.appList, (app, i) => {
                if (app.tables) return

                return this.instance.get(`${this._getAppVersionPath(app)}/data/tables`)
                    .then(({data}) => this.sortAndSet(`${i}.tables`, data.tables));

            })
        )
    }

    getAppRoles() {
        return Promise.all(
            _.map(this.appList, (app, i) => {
                if (app.roles) return
                return this.instance.get(`${this._getAppVersionPath(app)}/security/roles`)
                    .then(({data}) => this.sortAndSet(`${i}.roles`, data));
            })
        )
    }

    getAppRolePermissions() {
        return Promise.all(
            _.map(this.appList, (app, appIndex) => Promise.all(
                _.map(app.roles, (role, roleIndex) => {
                    if (role.permissions) return

                    return this.instance.get(
                        `${this._getAppVersionPath(app)}/security/roles/permissions/${role.roleId}`)
                        .then(({data}) => this.sortByParamsAndSet(`${appIndex}.roles.${roleIndex}.permissions`, data, ['type', 'operation']));

                })
            ))
        )
    }

    getAppUsers() {
        return Promise.all(
            _.map(this.appList, (app, i) => {
                return this.instance.get(`${this._getAppVersionPath(app)}/security/users`, this._getAppHeaders(app))
                    .then(({ data }) => this.sortAndSet(`${i}.users`, data))
            })
        )
    }

    getAppDataTableUserPermissions() {
        return Promise.all(
            _.map(this.appList, (app, appIndex) => Promise.all(
                _.map(this.appList[appIndex].tables, (table, tableIndex) => {
                    return this.instance.get(`${this._getAppVersionPath(app)}/security/data/${table.tableId}/users`, this._getAppHeaders(app))
                        .then(({ data }) => this.appList[appIndex].tables[tableIndex].users = data.data)
                })
            ))
        )
    }

    getAppDataTableRolePermissions() {
        return Promise.all(
            _.map(this.appList, (app, appIndex) => Promise.all(
                _.map(this.appList[appIndex].tables, (table, tableIndex) => {
                    return this.instance.get(`${this._getAppVersionPath(app)}/security/data/${table.tableId}/roles`, this._getAppHeaders(app))
                        .then(({ data }) => this.sortByParamsAndSet(`${appIndex}.tables.${tableIndex}.roles`, data, ['operation']))
                })
            ))
        )
    }

    /* Get main app meta data and return */
    getAppMeta() {
        return this.login()
            .then(() => this.loadFromFileIfNeeded())
            .then(() => this.getAppList())
            .then(() => this.filterAppList())
            .then(() => this.updateAppRefs())
    }

    /* Set controlApp & appsToCheck from appList and return copy of data */
    updateAppRefs() {
        this.controlApp = this._findAppByName(this.controlAppName)
        this.appsToCheck = _.map(this.appNamesToCheck, appName => this._findAppByName(appName))
        return _.pick(this, 'controlApp', 'appsToCheck')
    }

    /* sort and set data collections returned by API */
    sortAndSet(path, data) {
        return _.set(this.appList, path, _.sortBy(data, 'name'))
    }

    sortByParamsAndSet(path, data, params) {
        return _.set(this.appList, path, _.sortBy(data, params))
    }

    static normalize(app) {
        app.name = app.name || app.appName
        app.id = app.id || app.appId

        delete app.appName
        delete app.appId

        const normalizeTable = table => {
            table.columns = table.columns
                .filter(column => !SYSTEM_COLUMNS.includes(column.name))
        }

        if (app.tables) {
            app.tables.forEach(normalizeTable)
        }

        return app
    }

    static saveDataToFile(data, path, verbose) {
        return writeFile(path, JSON.stringify(data))
            .then(() => verbose && console.log(chalk.bold.green(`...... Schema is saved`)))
            .catch(e => console.error(e))
    }
}

module.exports = Backendless
