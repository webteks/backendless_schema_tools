const _ = require('lodash')

const CheckList = {
    SCHEMA     : 'schema',
    API        : 'api',
    TABLE_PERMS: 'table_perms',
    ROLE_PERMS : 'role_perms',
    API_PERMS  : 'api_perms'
}

module.exports = [
    { name: 'reference', alias: 'r', type: String, group: 'compare',defaultValue: ''},
    { name: 'compare', alias: 'c', type: String, defaultValue: [], multiple: true, group: 'compare'},
    { name: 'dump', alias: 'd', type: String, group: 'compare'},
    { name: 'username', alias: 'u', type: String, group: 'compare', defaultValue: ''},
    { name: 'password', alias: 'p', type: String, group: 'compare', defaultValue: ''},
    { name: 'backendless-url', alias: 'b', type: String, group: 'compare', defaultValue: 'api.backendless.com'},
    { name: 'timeout', alias: 't', type: Number, group: 'compare', defaultValue: 120000},
    { name: 'verbose', alias: 'v', type: Boolean, group: 'compare'},
    { name: 'monitor', alias: 'm', type: Boolean, group: 'compare'},
    { name: 'sync', alias: 's', type: Boolean, group: 'compare'},
    { name: 'check-list', alias: 'l', type: String, defaultValue: _.values(CheckList), multiple: true, group: 'compare'}
];

module.exports.CheckList = CheckList
