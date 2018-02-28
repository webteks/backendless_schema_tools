'use strict';

const _ = require('lodash');
const Table = require('cli-table');
const chalk = require('chalk');

const containsDifferences = (apps, roleName, rolesMap) => {
    const versions = _.uniqBy(apps, app => {
        const tableExistsInMoreThanOneApp = Object.keys(rolesMap[roleName]).length > 1;

        //ignore missed app tables. Such difference is reported by table comparator
        if (tableExistsInMoreThanOneApp) {
            const access = rolesMap[roleName][app.name];

            //ignore inherited permissions. Such difference is reported by app permissions comparator
            if (access && !access.includes('INHERIT')) {
                return access;
            }
        }
    })

    return versions.length > 1
}

const printDifferences = (apps, map) => {
    const table = new Table({
        head: ['Endpoint', 'Role', ...apps.map(app => app.name)]
    });

    let result = false

    Object.keys(map).sort().forEach(endpoint => {
        const rolesMap = map[endpoint];

        const roles = Object.keys(rolesMap).filter(roleName => containsDifferences(apps, roleName, rolesMap))

        if (roles.length === 0) {
            return
        }

        result = true

        table.push([
            endpoint,
            roles.join('\n'),
            ...apps.map(app => roles.map(roleName => rolesMap[roleName][app.name]).join('\n'))
        ])
    });

    if (result) {
        console.log('\nEndpoints Permissions:')
        console.log(table.toString())
    }

    return result
}

module.exports = apps => {
    const map = {}

    apps.forEach(app => {
        (app.services || []).forEach(service => {
            (service.methods || []).forEach(method => {
                const methodId = [service.name, method.method].join('.')
                const methodAccessMap = map[methodId] || (map[methodId] = {});

                Object.keys(method.roles).forEach(role => {
                    const access = method.roles[role]
                    const roleMap = methodAccessMap[role] || (methodAccessMap[role] = {});
                    roleMap[app.name] = access
                })
            })
        })
    });

    return printDifferences(apps, map);
};