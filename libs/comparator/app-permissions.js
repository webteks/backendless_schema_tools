'use strict';

const _ = require('lodash');
const Table = require('cli-table');
const chalk = require('chalk');

const containsDifferences = (apps, roleName, rolesMap) => {
    const versions = _.uniqBy(apps, app => rolesMap[roleName][app.name])

    return versions.length > 1
}

const printDifferences = (apps, appRolesMap) => {
    const table = new Table({
        head: ['Operation', 'Role', ...apps.map(app => app.name)]
    });

    let result = false

    Object.keys(appRolesMap).sort().forEach(operation => {
        const rolesMap = appRolesMap[operation]

        const roles = Object.keys(rolesMap).filter(roleName => containsDifferences(apps, roleName, rolesMap))

        if (roles.length === 0) {
            return
        }

        result = true

        table.push([
            operation,
            roles.join('\n'),
            ...apps.map(app => roles.map(roleName => rolesMap[roleName][app.name]).join('\n'))
        ])
    })

    if (result) {
        console.log('\nRoles Permissions:')
        console.log(table.toString())
    }

    return result
}

module.exports = apps => {
    const appRolesMap = {}

    apps.forEach(app => {
        app.roles.forEach(appRole => {
            _.sortBy(appRole.permissions, ['type', 'operation']).forEach(({ type, operation, access }) => {
                const opKey = `${type}.${operation}`

                appRolesMap[opKey] || (appRolesMap[opKey] = {})
                appRolesMap[opKey][appRole.rolename] || (appRolesMap[opKey][appRole.rolename] = {})
                appRolesMap[opKey][appRole.rolename][app.name] = access
            })
        })
    });

    return printDifferences(apps, appRolesMap);
};
