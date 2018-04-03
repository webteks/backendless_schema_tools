'use strict'

const _ = require('lodash')
const chalk = require('chalk')

const { buildAppRolesMap, containsDifferences } = require('../comparator/app-permissions')
const { prompt } = require('./helpers')


const removeRoleMsg = role =>
    `Are you sure you want to delete the role ${chalk.bold(`${role}`)}?`

const syncRoles = (api, apps) => {

    console.log('Roles sync..')

    const [sourceApp, ...targetApps] = apps

    const addRole = (app, rolename) =>
        api.addSecurityRole(app.id, rolename)
            .then(({ data: role }) => app.roles.push(role))

    const removeRole = (app, roleId, rolename) =>
        prompt(removeRoleMsg(rolename)).then(res =>
            res && api.removeSecurityRole(app.id, roleId)
                .then(() => app.roles = app.roles.filter(role => role.roleId !== roleId)))

    return Promise.all(targetApps.map(targetApp => {

        const forAdd = sourceApp.roles.filter(({ rolename }) => !_.find(targetApp.roles, { rolename }))
        const forRemove = targetApp.roles.filter(({ rolename }) => !_.find(sourceApp.roles, { rolename }))

        return Promise.all([
            ...forAdd.map(({ rolename }) => addRole(targetApp, rolename)),
            ...forRemove.map(({ roleId, rolename }) => removeRole(targetApp, roleId, rolename))
        ])
    }))
}

const syncRolesPermissions = (api, apps) => {
    console.log('Roles permissions sync..')

    const appRolesMap = buildAppRolesMap(apps)
    const [sourceApp, ...targetApps] = apps

    const promises = []

    Object.keys(appRolesMap).forEach(opKey => {
        const rolesMap = appRolesMap[opKey]
        const [type, operation] = opKey.split('.')

        const roles = Object.keys(rolesMap).filter(roleName => containsDifferences(apps, roleName, rolesMap))

        targetApps.forEach(app => {
            roles.forEach(roleName => {
                const { roleId } = app.roles.find(role => role.rolename === roleName)

                promises.push(api.updateSecurityRole(app.id, roleId, {
                    type,
                    operation,
                    access: rolesMap[roleName][sourceApp.name]
                }))
            })
        })
    })

    return Promise.all(promises)
}


module.exports = (api, apps) =>
    Promise.resolve()
        .then(() => syncRoles(api, apps))
        .then(() => syncRolesPermissions(api, apps))
