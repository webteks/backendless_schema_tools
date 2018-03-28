'use strict'

const _ = require('lodash')

const { containsDifferences, buildTableRolesMap } = require('../comparator/tables-permissions')


module.exports = (api, apps) => {
    console.log('Tables permissions sync..')

    const tableRolesMap = buildTableRolesMap(apps)
    const [sourceApp, ...targetApps] = apps
    const permissionsMap = {}

    Object.keys(tableRolesMap).forEach(tableName => {
        const operationsMap = tableRolesMap[tableName]

        Object.keys(operationsMap).forEach(operation => {
            const rolesMap = operationsMap[operation]
            const roles = Object.keys(rolesMap).filter(roleName => containsDifferences(apps, roleName, rolesMap))

            targetApps.forEach(app => {
                const table = app.tables.find(table => table.name === tableName)

                roles.forEach(roleName => {
                    const { roleId } = table.roles.find(role => role.name === roleName)
                    const access = rolesMap[roleName][sourceApp.name]

                    const key = `${app.id}.${table.tableId}.${roleId}`

                    permissionsMap[key] || (permissionsMap[key] = [])
                    permissionsMap[key].push({ operation, access })
                })
            })
        })
    })

    const promises = []

    targetApps.forEach(app => {
        app.tables.forEach(table => {
            (table.roles || []).forEach(role => {
                const permissions = permissionsMap[`${app.id}.${table.tableId}.${role.roleId}`]

                if (permissions) {
                    promises.push(Promise.resolve()
                        .then(() => api.resetTablePermissions(app.id, table.tableId, role.roleId))
                        .then(() => api.updateTablePermissions(app.id, table.tableId, role.roleId, { permissions }))
                        .catch(err => console.error(err.response.data)))
                }

            })
        })
    })

    return Promise.all(promises)
}