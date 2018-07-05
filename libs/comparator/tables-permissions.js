'use strict';

const _ = require('lodash');
const Table = require('cli-table');

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

const printDifferences = (apps, tablesMap) => {
    const table = new Table({
        head: ['Table Operation', 'Role', ...apps.map(app => app.name)]
    });

    let result = false

    Object.keys(tablesMap).sort().forEach(tableName => {
        const operationsMap = tablesMap[tableName];

        Object.keys(operationsMap).sort().forEach(operation => {
            const rolesMap = operationsMap[operation]

            const roles = Object.keys(rolesMap).filter(roleName => containsDifferences(apps, roleName, rolesMap))

            if (roles.length === 0) {
                return
            }

            result = true

            table.push([
                `${tableName}.${operation}`,
                roles.join('\n'),
                ...apps.map(app => roles.map(roleName => rolesMap[roleName][app.name]).join('\n'))
            ])
        })
    });

    if (result) {
        console.log('\nTable Permissions:\n' + table.toString())
    }

    return result
}


const buildTableRolesMap = apps => {
    return apps.reduce((map, app) => {
        app.tables.forEach(table => {
            const tableMap = map[table.name] || (map[table.name] = {});

            (table.roles || []).forEach(appRole => {
                _.sortBy(appRole.permissions, 'operation').forEach(({ operation, access }) => {
                    const operationMap = tableMap[operation] || (tableMap[operation] = {})
                    operationMap[appRole.name] || (operationMap[appRole.name] = {})
                    operationMap[appRole.name][app.name] = access
                })
            })
        })

        return map
    }, {})
}

module.exports = apps => {
    const map = buildTableRolesMap(apps)

    return printDifferences(apps, map);
};

module.exports.buildTableRolesMap = buildTableRolesMap
module.exports.containsDifferences = containsDifferences