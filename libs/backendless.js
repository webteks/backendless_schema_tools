let instance
const async = require('async');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const http = require('http');
const Agent = require('agentkeepalive');

let agent = new Agent({
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketKeepAliveTimeout: 30000
})
let options = {
    "hostname": "develop.backendless.com",
    "port": 80,
    "agent": agent,
    "headers": {
        "content-type": "application/json",
        "application-type": "REST"
    }
}


function Backendless(username,password,application1,application2,reportingDirectory,backendlessVersion){
    if (instance === undefined) {
        instance = this
    }
    instance.username = username
    instance.password = password
    instance.application1 = application1
    instance.application2 = application2
    instance.reportingDirectory = reportingDirectory
    instance.backendlessVersion =  backendlessVersion
    instance.options = options
    instance.applications = []
}


function cleanUp() {
    return new Promise((resolve,reject)=>{
        async.series([
            function(callback){
                fs.unlink(path.join(__dirname,'application1_tables.csv'),function(err){
                    console.log(chalk.white('.....Deleted application1_tables.csv'));
                    callback(null);
                })
            },
            function(callback){
                fs.unlink(path.join(__dirname,'application2_tables.csv'),function(err){
                    console.log(chalk.white('.....Deleted application2_tables.csv'));
                    callback(null);
                })
            },
            function(callback){
                fs.unlink(path.join(__dirname,'issues_report.log'),function(err){
                    console.log(chalk.white('.....Deleted issues_report.log'));
                    callback(null);
                })
            }
        ],function(){
            resolve(null);
        })
    })

}

function login(){
    return new Promise((resolve,reject)=>{
        instance.options.username = instance.username;
        instance.options.password = instance.password;
        instance.options.path =  "/console/home/login";
        instance.options.method = 'POST';
        let req = http.request(options, function (res) {
            var chunks = [];
            res.on("data", function (chunk) {
                chunks.push(chunk);
            });
            res.on("end", function () {
                let body = Buffer.concat(chunks);
                if (this.headers['auth-key']) {
                    console.log(chalk.white('.....Successfully logged into developer api'));
                    instance.options.auth_key = this.headers['auth-key'];
                    instance.options.headers['auth-key'] = this.headers['auth-key'];
                    console.log(chalk.white('.....HTTP Agent updated for reuse'));
                    instance.options.initialized = true;
                    instance.options.authorized = true;
                    resolve(null)
                } else {
                    let msg = 'Unable to login to developer api with supplied credentials'
                    console.log(chalk.bgYellow.red(msg));
                    reject(msg);
                }
            });
            res.on("error", function(err){
                reject(err)
            })
        });
        req.write(JSON.stringify({ login: instance.username,
            password: instance.password}));
        req.end();
    })
}

function listApplications(){
    return new Promise((resolve,reject)=>{
        instance.options.path = '/console/applications';
        instance.options.method = 'GET';
        console.log(options);
        //options.headers['application-id'] = applicationId;
        let req = http.request(options, function (res) {
            var chunks = [];

            res.on("data", function (chunk) {
                chunks.push(chunk);
            });

            res.on("end", function () {
                var body = Buffer.concat(chunks);
                //console.log(JSON.parse(body.toString()));
                const resBody = JSON.parse(body.toString());
                resBody.map((item)=>{
                    if (item.version == instance.backendlessVersion) {
                        instance.applications.push(item)
                    }
                })
                chalk.yellow(console.log('Found', instance.applications.length,'applications in your Backendless environment'))
                resolve(resBody);
            });

            res.on("error", function(err){
                reject(err);
            })
        });
        req.end();
    })
}

function populateApplicationsVersionId(){
    return new Promise((resolve,reject)=>{
        instance.applications.forEach((app,appIndex)=>{
            let applicationId = app.appId
            instance.options.path = '/3.x/console/applications';
            instance.options.method = 'GET';
            instance.options.headers['application-id'] = applicationId;
            let req = http.request(options, function (res) {
                var chunks = [];

                res.on("data", function (chunk) {
                    chunks.push(chunk);
                })

                res.on("end", function () {
                    let body = Buffer.concat(chunks);
                    let items = JSON.parse(body.toString());
                    if (items.length > 0){
                        items.forEach(function(item,itemIndex){
                            if (item.appId == applicationId) {
                                instance.applications[appIndex].currentVersionId = item.currentVersionId
                                if (appIndex == instance.applications.length -1) {
                                    resolve(null)
                                }
                            }
                        })

                    }
                })

                res.on("error", function(err){
                    reject(err);
                })
            });
            req.end();
        })

    })
}

function populateApplicationRestSecret(options,appIndex,callback) {
    let req = http.request(options, function (res) {
        var chunks = [];

        res.on("data", function (chunk) {
            chunks.push(chunk);
        });

        res.on("end", function () {
            var body = Buffer.concat(chunks);
            let restSecret = body.toString()
            if (restSecret) {
                instance.applications[appIndex].restSecret = restSecret
                let msg = '..... Retrieving rest secret for ' + instance.applications[appIndex].appName
                chalk.white(console.log(msg))
                callback(restSecret);

            } else {
                let msg = 'Unable to get REST Secret for application' + instance.applications[appIndex].appName
                chalk.red(console.log(msg))
                callback(msg)
            }
        })
    })
    req.on('error',(error)=>{
        callback(error)
    })
    req.end();
}

function populateApplicationsRestSecret() {
    let msg = '.....Populating rest secrets for all applications'
    chalk.white(console.log(msg))
    return new Promise((resolve,reject)=>{
        instance.applications.forEach((app,appIndex)=>{
            let applicationId = app.appId
            this.options = options
            this.options.path = '/3.x/console/application/' + applicationId + '/secretkey/REST'
            this.options.method = 'GET'
            this.options.headers['application-id'] = applicationId
            let populate = () => {
                populateApplicationRestSecret(this.options,appIndex,(error)=>{
                    if (error) reject(error)
                    if (appIndex == instance.applications.length -1) {
                        resolve(null)
                    }
                })
            }
            process.nextTick(populate)
        });
    })
}

function populateApplicationDataTables(options,appIndex,callback) {
    let req = http.request(options, function (res) {
        let chunks = [];

        res.on("data", function (chunk) {
            chunks.push(chunk);
        });

        res.on("end", function () {
            var body = Buffer.concat(chunks);
            let tables = JSON.parse(body.toString())
            instance.applications[appIndex].dataTables = tables
            let msg = "..... Retrieved all data tables for " + instance.applications[appIndex].appName
            process.nextTick(callback)
        });
    });
    req.end()
    req.on("error", function(err){
        callback(err)
    })
}

function populateApplicationsDataTables(){
    let msg = ".....Retrieving all applications data tables"
    chalk.white(console.log(msg))
    return new Promise((resolve,reject)=>{
        let waiting = instance.applications.length
        instance.applications.forEach((app,appIndex)=>{
            let appVersionId = app.currentVersionId
            let applicationId = app.appId
            let secretKey = app.restSecret
            this.options = options
            this.options.path = '/3.x/console/appversion/' + appVersionId + '/data/tables';
            this.options.method = 'GET';
            this.options.headers['application-id'] = applicationId;
            this.options.headers['secret-key'] = secretKey;


            let populate = () => {
                populateApplicationDataTables(this.options, appIndex, (error) => {
                    if (error) reject(error)
                    waiting = waiting -1
                    if (waiting == 0) {
                        resolve(null)
                    }
                })
            }
            process.nextTick(populate)
        })

    })
}

function populateApplicationRoles(options,appIndex,callback){

    let req = http.request(options, function (res) {
        let chunks = [];

        res.on("data", function (chunk) {
            chunks.push(chunk);
        });

        res.on("end", function () {
            var body = Buffer.concat(chunks);
            let tables = JSON.parse(body.toString())
            instance.applications[appIndex].securityRoles = tables
            let msg = "..... Retrieving all security roles for " + instance.applications[appIndex].appName
            chalk.white(console.log(msg))
            process.nextTick(callback)
        });
    });
    req.end()
    req.on("error", function(err){
        callback(err)
    })
}

function populateApplicationsRoles(){
    let msg = ".....Retrieving all applications security roles"
    chalk.white(console.log(msg))
    return new Promise((resolve,reject)=>{
        let waiting = instance.applications.length
        instance.applications.forEach((app,appIndex)=>{
            let appVersionId = app.currentVersionId
            let applicationId = app.appId
            let secretKey = app.restSecret
            this.options = options
            this.options.path = '/3.x/console/appversion/' + appVersionId + '/security/roles';
            this.options.method = 'GET';
            this.options.headers['application-id'] = applicationId;
            this.options.headers['secret-key'] = secretKey
            let msg = '..... Retrieving security roles for ' + instance.applications[appIndex].appName
            chalk.white(console.log(msg))

            let populate = () => {
                populateApplicationRoles(this.options, appIndex, (error) => {
                    if (error) reject(error)
                    waiting = waiting -1
                    if (waiting == 0) {
                        process.nextTick(resolve)
                    }
                })
            }
            process.nextTick(populate)
        })

    })
}

function populateApplicationSecurityRolePermissions(options,appIndex,securityIndex,callback) {

    let req = http.request(options, function (res) {
        let chunks = [];

        res.on("data", function (chunk) {
            chunks.push(chunk);
        });

        res.on("end", function () {
            var body = Buffer.concat(chunks);
            let security = JSON.parse(body.toString())
            instance.applications[appIndex].securityRoles[securityIndex].permissions = security
            //let msg = "..... Retrieving all security roles for " + instance.applications[appIndex].appName + ' Role: ' + instance.applications[appIndex].securityRoles[securityIndex]
            //chalk.white(console.log(msg))
            process.nextTick(callback)
        });
    });
    req.end()
    req.on("error", function(err){
        callback(err)
    })
}

function populateApplicationSecurityRolesPermissions(){
    let msg = ".....Retrieving all applications security roles permissions"
    chalk.white(console.log(msg))
    return new Promise((resolve,reject)=>{
        let appWaiting = instance.applications.length
        instance.applications.forEach((app,appIndex)=>{
            let securityWaiting = instance.applications[appIndex].securityRoles.length
            appWaiting = appWaiting -1
            process.nextTick(()=>{
                instance.applications[appIndex].securityRoles.forEach((securityRole,securityIndex)=>{

                    let appVersionId = app.currentVersionId
                    let applicationId = app.appId
                    let secretKey = app.restSecret
                    this.options = options
                    this.options.path = '/3.x/console/appversion/' + appVersionId + '/security/roles/permissions/' + securityRole.roleId;
                    this.options.method = 'GET';
                    this.options.headers['application-id'] = applicationId;
                    this.options.headers['secret-key'] = secretKey
                    //let secRole = securityRole.rolename.toString()
                    //let msg = '..... Retrieving security role permissions for ' + instance.applications[appIndex].appName + ' Role: ' + secRole
                    //chalk.white(console.log(msg))

                    let populate = ()=> {
                        populateApplicationSecurityRolePermissions(this.options, appIndex, securityIndex, (error) => {
                            if (error) reject(error)
                            securityWaiting = securityWaiting -1
                            if (appWaiting == 0 && securityWaiting == 0) {
                                process.nextTick(resolve)
                            }
                        })
                    }
                    process.nextTick(populate)
                });
            })

        })

    })
}

function populateApplicationUsers(options,appIndex,callback){

    let req = http.request(options, function (res) {
        let chunks = [];

        res.on("data", function (chunk) {
            chunks.push(chunk);
        });

        res.on("end", function () {
            var body = Buffer.concat(chunks);
            let users = JSON.parse(body.toString())
            instance.applications[appIndex].users = users
            let msg = "..... Retrieving all users for " + instance.applications[appIndex].appName
            chalk.white(console.log(msg))
            callback(null)
        });
    });
    req.end()
    req.on("error", function(err){
        callback(err)
    })
}

function populateApplicationsUsers(){
    let msg = ".....Retrieving all applications users"
    chalk.white(console.log(msg))
    return new Promise((resolve,reject)=>{
        instance.applications.forEach((app,appIndex)=>{
            let appVersionId = app.currentVersionId
            let applicationId = app.appId
            let secretKey = app.restSecret
            this.options = options
            this.options.path = '/3.x/console/appversion/' + appVersionId + '/security/users';
            this.options.method = 'GET';
            this.options.headers['application-id'] = applicationId;
            this.options.headers['secret-key'] = secretKey
            let msg = '..... Retrieving application users for ' + instance.applications[appIndex].appName
            chalk.white(console.log(msg))

            let populate = ()=> {
                populateApplicationUsers(this.options, appIndex, (error) => {
                    if (error) reject(error)
                    if (appIndex == instance.applications.length - 1) {
                        process.nextTick(resolve)
                    }
                })
            }
            process.nextTick(populate)
        })
    })
}

function populateApplicationDataTablesUserPermissions(options,appIndex,securityIndex,callback){

    let req = http.request(options, function (res) {
        let chunks = [];

        res.on("data", function (chunk) {
            chunks.push(chunk);
        });

        res.on("end", function () {
            var body = Buffer.concat(chunks);
            let tableSecurity = JSON.parse(body.toString())
            instance.applications[appIndex].dataTables.usersTables[securityIndex].userPermissions = tableSecurity
            //let msg = "..... Retrieving all security roles for " + instance.applications[appIndex].appName + ' Role: ' + instance.applications[appIndex].securityRoles[securityIndex]
            //chalk.white(console.log(msg))
            process.nextTick(callback)
        });
    });
    req.end()
    req.on("error", function(err){
        callback(err)
    })
}

function populateApplicationsDataTablesUserPermissions() {
    let msg = ".....Retrieving all applications data tables assigned user permissions"
    return new Promise((resolve,reject)=>{
        let appWaiting = instance.applications.length
        instance.applications.forEach((app,appIndex)=>{
            let securityWaiting = instance.applications[appIndex].dataTables.usersTables.length
            appWaiting = appWaiting -1
                instance.applications[appIndex].dataTables.usersTables.forEach((table,securityIndex)=>{

                    let appVersionId = app.currentVersionId
                    let applicationId = app.appId
                    let secretKey = app.restSecret
                    this.options = options
                    this.options.path = '/3.x/console/appversion/' + appVersionId + '/security/data/' + table.tableId + '/users'
                    this.options.method = 'GET';
                    this.options.headers['application-id'] = applicationId;
                    this.options.headers['secret-key'] = secretKey
                    //let secRole = securityRole.rolename.toString()
                    //let msg = '..... Retrieving security role permissions for ' + instance.applications[appIndex].appName + ' Role: ' + secRole
                    //chalk.white(console.log(msg))

                    let populate = ()=> {
                        populateApplicationDataTablesUserPermissions(this.options, appIndex, securityIndex, (error) => {
                            if (error) reject(error)
                            securityWaiting = securityWaiting -1
                            if (appWaiting == 0 && securityWaiting == 0) {
                                process.nextTick(resolve)
                            }
                        })
                    }
                    process.nextTick(populate)
                });
        })

    })
}

function populateApplicationDataTablesRolePermissions(options,appIndex,securityIndex,callback){

    let req = http.request(options, function (res) {
        let chunks = [];

        res.on("data", function (chunk) {
            chunks.push(chunk);
        });

        res.on("end", function () {
            var body = Buffer.concat(chunks);
            let tableSecurity = JSON.parse(body.toString())
            instance.applications[appIndex].dataTables.usersTables[securityIndex].rolePermissions = tableSecurity
            //let msg = "..... Retrieving all security roles for " + instance.applications[appIndex].appName + ' Role: ' + instance.applications[appIndex].securityRoles[securityIndex]
            //chalk.white(console.log(msg))
            process.nextTick(callback)
        });
    });
    req.end()
    req.on("error", function(err){
        callback(err)
    })
}

function populateApplicationsDataTablesRolePermissions() {
    let msg = ".....Retrieving all applications data tables assigned role permissions"
    return new Promise((resolve,reject)=>{
        let appWaiting = instance.applications.length
        instance.applications.forEach((app,appIndex)=>{
            let securityWaiting = instance.applications[appIndex].dataTables.usersTables.length
            appWaiting = appWaiting -1
            instance.applications[appIndex].dataTables.usersTables.forEach((table,securityIndex)=>{

                let appVersionId = app.currentVersionId
                let applicationId = app.appId
                let secretKey = app.restSecret
                this.options = options
                this.options.path = '/3.x/console/appversion/' + appVersionId + '/security/data/' + table.tableId + '/roles'
                this.options.method = 'GET';
                this.options.headers['application-id'] = applicationId;
                this.options.headers['secret-key'] = secretKey
                //let secRole = securityRole.rolename.toString()
                //let msg = '..... Retrieving security role permissions for ' + instance.applications[appIndex].appName + ' Role: ' + secRole
                //chalk.white(console.log(msg))

                let populate = ()=> {
                    populateApplicationDataTablesRolePermissions(this.options, appIndex, securityIndex, (error) => {
                        if (error) reject(error)
                        securityWaiting = securityWaiting -1
                        if (appWaiting == 0 && securityWaiting == 0) {
                            //console.log(JSON.stringify(instance.applications[appIndex]))
                            process.nextTick(resolve)

                        }
                    })
                }
                process.nextTick(populate)
            });
        })

    })
}

Backendless.prototype.login = login
Backendless.prototype.cleanUp = cleanUp
Backendless.prototype.listApplications = listApplications
Backendless.prototype.populateApplicationsVersionId = populateApplicationsVersionId
Backendless.prototype.populateApplicationsRestSecret = populateApplicationsRestSecret
Backendless.prototype.populateApplicationsDataTables = populateApplicationsDataTables
Backendless.prototype.populateApplicationsRoles = populateApplicationsRoles
Backendless.prototype.populateApplicationSecurityRolesPermissions = populateApplicationSecurityRolesPermissions
Backendless.prototype.populateApplicationsUsers = populateApplicationsUsers
Backendless.prototype.populateApplicationsDataTablesUserPermissions = populateApplicationsDataTablesUserPermissions
Backendless.prototype.populateApplicationsDataTablesRolePermissions = populateApplicationsDataTablesRolePermissions

module.exports = Backendless;
