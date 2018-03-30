'use strict'

const request = require('axios')
const assert = require('assert')

const ADMIN_EMAIL = 'tempadmin@admin.admin'
const ADMIN_PASSWORD = 'droneup2018'
const ADMIN_ROLE = 'DARTadmin'

const createAdmin = async (api, app) => {
    const createUser = (appId, user) =>
        api.createRecord(appId, 'Users', user)

    const getRoleId = async (appId, name) => {
        const role = await api.getRoles(appId)
            .then(({ data: roles }) => roles.find(role => role.rolename === name))

        assert(role, `${name} role doesn't exist`)

        return role.roleId
    }


    const user = await createUser(app.id, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .then(({ data }) => data)

    await api.updateAssignedUserRoles(app.id, [user.objectId], [{
        roleId: await getRoleId(app.id, ADMIN_ROLE),
        status: 'ALL'
    }])

    return userCache[app.id] = user
}

const loginAdmin = async (baseUrl, app) => {
    const user = await request.post(`${baseUrl}/${app.id}/${app.secretKey}/users/login`, {
        login   : ADMIN_EMAIL,
        password: ADMIN_PASSWORD
    }).then(({ data }) => data)

    return userCache[app.id] = user
}

const bulkUpdateUrl = (baseUrl, appId, apiKey, table, where) =>
    `${baseUrl}/${appId}/${apiKey}/data/bulk/${table}?where=${where}`

const userCache = {}

module.exports = {
    bulkUpdate: async (api, app, table, where, data) => {
        let user = userCache[app.id]

        try {
            !user && await createAdmin(api, app)
        } catch (e) {
            if (!e.response.data.message.includes('User already exists')) {
                throw e
            }

            user = await loginAdmin(api.serverBaseURL, app)
        }

        user = !(user && user['user-token']) && await loginAdmin(api.serverBaseURL, app)

        const path = bulkUpdateUrl(api.serverBaseURL, app.id, app.secretKey, table, where)
        const headers = { 'user-token': user['user-token'] }

        return request.put(path, data, { headers })
    },

    cleanup: (api, apps) => Promise.all(
        apps.slice(1).map(app => userCache[app.id] && api.deleteRecord(app.id, 'Users', userCache[app.id])))
}