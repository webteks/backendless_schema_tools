'use strict'

const { buildEndpointsRolesMap } = require('../comparator/endpoints-permissions')
const { containsDifferences } = require('../comparator/tables-permissions')
const { runInParallel } = require('../../utils/async')

module.exports = (api, apps) => {
  console.log('Endpoints permissions sync..')

  const endpointsRolesMap = buildEndpointsRolesMap(apps)
  const [sourceApp, ...targetApps] = apps
  const permissionsMap = {}

  Object.keys(endpointsRolesMap).forEach(endpoint => {
    const rolesMap = endpointsRolesMap[endpoint]
    const [serviceName, methodName] = endpoint.split('.')

    const roles = Object.keys(rolesMap).filter(roleName => containsDifferences(apps, roleName, rolesMap))

    targetApps.forEach(app => {
      const service = app.services.find(service => service.name === serviceName)

      if (!service) {
        return
      }

      const method = service.methods.find(({ method }) => method === methodName)

      roles.forEach(roleName => {
        const { roleId } = app.roles.find(role => role.rolename === roleName)
        const access = rolesMap[roleName][sourceApp.name]
        const key = [app.id, service.id, roleId].join('.')

        permissionsMap[key] || (permissionsMap[key] = [])
        permissionsMap[key].push({ operation: method.id, access })
      })
    })
  })

  const tasks = []

  Object.keys(permissionsMap).forEach(key => {
    const [appId, serviceId, roleId] = key.split('.')
    const permissions = []
    const inheritedPermissions = []

    permissionsMap[key].forEach(perm => {
      perm.access.includes('INHERIT') && inheritedPermissions.push(perm)
      !perm.access.includes('INHERIT') && permissions.push(perm)
    })

    inheritedPermissions.forEach(perm => {
      tasks.push(() => api.resetEndpointPermissions(appId, serviceId, roleId, perm.operation))
    })

    tasks.push(() => api.updateEndpointPermissions(appId, serviceId, roleId, { permissions })
      .catch(err => console.error(err.response && (err.response.data || err.response) || err)))
  })

  return runInParallel(tasks, 10)
}