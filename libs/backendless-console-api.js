const _ = require('lodash');
const axios = require('axios');
const chalk = require('chalk');
const Promise = require('bluebird');

class Backendless {
    constructor(username,password,controlAppName,appNamesToCheck,reportingDir,beVersion,timeout) {
        /* Make a list of apps that are contextual to this check */
        const appsContext = _.concat(controlAppName, appNamesToCheck);

        /* Determine backendless api version for use after login */
        const apiVersionPath = beVersion.slice(0,1) === '3' ? '/console' : '/console';

        /* Create axios request instance for http calls */
        const instance = axios.create({
            baseURL: 'https://droneup.backendless.com/',
            timeout: timeout,
            headers: {
                'content-type': 'application/json',
                'application-type': 'REST'
            }
        });

        /* Log method and URL for all requests */
        instance.interceptors.request.use(config => {
            //console.log(chalk.cyan(`Making ${chalk.bold(config.method.toUpperCase())} request to ${chalk.bold(config.url)}`));
            return config;
        });

        /* Log success or failure for all requests on response */
        instance.interceptors.response.use(res => {
            //console.log(chalk.bold.green(`...... SUCCESS`));
            return res;
        });

        /* Assign input vars to object instance */
        _.assign(this, {
            apiVersionPath,
            appsContext,
            appList: [],
            appsToCheck: [],
            appNamesToCheck,
            beVersion,
            controlApp: {},
            controlAppName,
            instance,
            password,
            reportingDir,
            username,
        });

    }

    /* Find app in appList */
    _findAppByName(appName) {
        return _.find(this.appList, {'appName': appName});
    }

    /* Build app headers given appId and secretKey */
    _getAppHeaders({appId, secretKey}) {
        return {headers:{'application-id': appId,'secret-key': secretKey}};
    }

    /* Build appversion api path provided currentVersionId */
    _getAppVersionPath({currentVersionId}) {
        return `${this.apiVersionPath}/appversion/${currentVersionId}`
    };

    /* Authenticate user & add auth-key to header for future requests */
    login() {
        return this.instance.post('/console/home/login', {'login': this.username, 'password': this.password})
            .then(res => this.instance.defaults.headers['auth-key'] = res.headers['auth-key']);
    }

    /* Get application list */
    getAppList() {
        return this.instance.get('/console/applications')
            .then(({data: appList}) => this.appList = appList);
    }

    /* Filter application list based on beVersion & which apps are actually needed for checks */
    filterAppList() {
        this.appList = _(this.appList)
                        .filter(app => _.includes(this.appsContext, app.appName))
                        .value();
        return;
    }

    /* Get app version ids. Regardless of appId used all apps are returned. */
    getAppVersions() {
        const appId = this.appList[0].appId;
        return this.instance.get(`${this.apiVersionPath}/applications`, {headers: {'application-id': appId}})
            .then(({data: appVersions}) => {
                this.appList = _.map(this.appList, app => _.assign(app, _.find(appVersions, {'appId': app.appId})))
            });
    }

    /* Get app secrets */
    getAppSecrets() {
        return Promise.all(
            _.map(this.appList, (app, i) => {
                return this.instance.get(
                    `${this.apiVersionPath}/application/${app.appId}/secretkey/REST`,
                    {headers: {'application-id': app.appId}}
                )
                .then(({data: secretKey}) => this.appList[i].secretKey = secretKey);
            })
        );
    }

    /* Get app data tables */
    getAppDataTables() {
        return Promise.all(
            _.map(this.appList, (app, i) => {
                return this.instance.get(
                    `${this._getAppVersionPath(app)}/data/tables`,
                    this._getAppHeaders(app)
                )
                .then(({data}) => this.sortAndSet(`${i}.tables`, data.tables));
            })
        );
    }

    getAppRoles() {
        return Promise.all(
            _.map(this.appList, (app, i) => {
                return this.instance.get(`${this._getAppVersionPath(app)}/security/roles`, this._getAppHeaders(app))
                    .then(({data}) => this.sortAndSet(`${i}.roles`, data));
            })
        );
    }

    getAppRolePermissions() {
        return Promise.all(
            _.map(this.appList, (app, appIndex) => Promise.all(
                _.map(app.roles, (role, roleIndex) => {
                    return this.instance.get(
                        `${this._getAppVersionPath(app)}/security/roles/permissions/${role.roleId}`,
                        this._getAppHeaders(app)
                    )
                    .then(({data}) => this.sortByParams(`${appIndex}.roles.${roleIndex}.permissions`, data, ['type', 'operation']));
                })
            ))
        );
    }

    getAppUsers() {
        return Promise.all(
            _.map(this.appList, (app, i) => {
                return this.instance.get(`${this._getAppVersionPath(app)}/security/users`, this._getAppHeaders(app))
                    .then(({data}) => this.sortAndSet(`${i}.users`, data));
            })
        );
    }

    getAppDataTableUserPermissions() {
        return Promise.all(
            _.map(this.appList, (app, appIndex) => Promise.all(
                _.map(this.appList[appIndex].tables, (table, tableIndex) => {
                    return this.instance.get(`${this._getAppVersionPath(app)}/security/data/${table.tableId}/users`, this._getAppHeaders(app))
                        .then(({data}) => this.appList[appIndex].tables[tableIndex].users = data.data);
                })
            ))
        );
    }

    getAppDataTableRolePermissions() {
        return Promise.all(
            _.map(this.appList, (app, appIndex) => Promise.all(
                _.map(this.appList[appIndex].tables, (table, tableIndex) => {
                    return this.instance.get(`${this._getAppVersionPath(app)}/security/data/${table.tableId}/roles`, this._getAppHeaders(app))
                        .then(({data}) => this.sortByParams(`${appIndex}.tables.${tableIndex}.roles`, data, ['operation']));
                })
            ))
        );
    }

    /* Get main app meta data and return */
    getAppMeta() {
        return this.login()
            .then(() => this.getAppList())
            .then(() => this.filterAppList())
            .then(() => this.getAppVersions())
            .then(() => this.getAppSecrets())
            .then(() => this.updateAppRefs());
    }

    /* Set controlApp & appsToCheck from appList and return copy of data */
    updateAppRefs() {
        this.controlApp = this._findAppByName(this.controlAppName);
        this.appsToCheck = _.map(this.appNamesToCheck, appName => this._findAppByName(appName));
        return _.pick(this, 'controlApp', 'appsToCheck');
    }

    /* sort and set data collections returned by API */
    sortAndSet(path, data) {
        _.set(this.appList, path, _.sortBy(data, 'name'));
    }

    sortByParams(path, data, params) {
        _.set(this.appList, path, _.sortBy(data, params));
    }
}

module.exports = Backendless;
