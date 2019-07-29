'use strict'

const { containsDifferences, buildTableRolesMap } = require('../comparator/tables-permissions')
const { runInParallel } = require('../../utils/async')

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
          const { roleId } = app.roles.find(role => role.rolename === roleName)
          const access = rolesMap[roleName][sourceApp.name]

          const key = [app.id, table.tableId, roleId].join('.')

          permissionsMap[key] || (permissionsMap[key] = [])
          permissionsMap[key].push({ operation, access })
        })
      })
    })
  })

  console.log(permissionsMap)

  const tasks = []

  Object.keys(permissionsMap).forEach(key => {
    const [appId, tableId, roleId] = key.split('.')

    const permissions = permissionsMap[key].filter(({ access }) => !access.includes('INHERIT'))

    tasks.push(() => {
      return Promise.resolve()
        .then(() => api.resetTablePermissions(appId, tableId, roleId))
        .then(() => permissions.length && api.updateTablePermissions(appId, tableId, roleId, { permissions }))
    })
  })

  return runInParallel(tasks, 10)
}