'use strict';

const _ = require('lodash');
const Table = require('cli-table');
const chalk = require('chalk');

const containsDifferences = (apps, method, appsMap) => {
    const versions = _.uniqBy(apps, app => {
        return appsMap[app.name]
    })

    return versions.length > 1
}

const printDifferences = (apps, map) => {
    const table = new Table({
        head: ['Service', 'Method', ...apps.map(app => app.name)]
    });

    let result = false

    Object.keys(map).forEach(service => {
        const serviceMap = map[service];

        const methods = Object.keys(serviceMap)
            .filter(method => containsDifferences(apps, method, serviceMap[method]))

        if (methods.length === 0) {
            return
        }

        result = true

        table.push([
            service,
            methods.join('\n'),
            ...apps.map(app => methods.map(method => serviceMap[method][app.name] ? '+' : '-').join('\n'))
        ])
    });

    if (result) {
        console.log('\nEndpoints:\n' + table.toString())
    }

    return result
}

module.exports = apps => {
    const map = {}

    apps.forEach(app => {
        (app.services || []).forEach(service => {
            const methodsMap = map[service.name] || (map[service.name] = {});

            (service.methods || []).forEach(method => {
                const methodMap = methodsMap[method.method] || (methodsMap[method.method] = {});
                methodMap[app.name] = true
            })
        })
    });

    return printDifferences(apps, map);
};