'use strict'

const Table = require('cli-table')

const { containsDifferences } = require('./tables-permissions')

const printDifferences = (apps, map) => {
    const table = new Table({
        head: ['Endpoint', 'Role', ...apps.map(app => app.name)]
    })

    let result = false

    Object.keys(map).sort().forEach(endpoint => {
        const rolesMap = map[endpoint]

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
    })

    if (result) {
        console.log('\nEndpoints Permissions:')
        console.log(table.toString())
    }

    return result
}

const buildEndpointsRolesMap = apps => {
    return apps.reduce((map, app) => {
        (app.services || []).forEach(service => {
            (service.methods || []).forEach(method => {
                const methodId = [service.name, method.method].join('.')
                const methodAccessMap = map[methodId] || (map[methodId] = {})

                Object.keys(method.roles).forEach(role => {
                    const access = method.roles[role]
                    const roleMap = methodAccessMap[role] || (methodAccessMap[role] = {})
                    roleMap[app.name] = access
                })
            })
        })

        return map
    }, {})
}

module.exports = apps => printDifferences(apps, buildEndpointsRolesMap(apps))

module.exports.buildEndpointsRolesMap = buildEndpointsRolesMap
