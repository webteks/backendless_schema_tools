const ansi = require('ansi-escape-sequences')
const { CheckList } = require('./command-options')
const _ = require('lodash')


/**
 * This is the help screen, default usage.
 * @type {*[]}
 */
/*
 name: 'help',
 description: 'Prints this usage guide'
 */
module.exports = [
    {
        header    : 'Compare database schema of two Backendless Applications',
        group     : ['compare', '_none'],
        optionList: [
            {
                name       : 'username',
                alias      : 'u',
                typeLabel  : '[underline]{\[\'developer@company.com\'\]}',
                description: 'Required'
            },
            {
                name       : 'password',
                alias      : 'p',
                typeLabel  : '[underline]{\[\'developersPassowrd\'\]}',
                description: 'Required'
            },
            {
                name       : 'reference',
                alias      : 'r',
                typeLabel  : '[underline]{\[\'live (Reference) \'\]}',
                description: 'Required: Reference Backendless Application name or path to dump-file'
            },
            {
                name       : 'compare',
                alias      : 'c',
                typeLabel  : '[underline]{\[\'dev (Comparison)\'\]}',
                description: 'Required: Space separated array of application names or paths to compare ie: \n dev alpha'
            },
            {
                name       : 'backendless-url',
                alias      : 'b',
                typeLabel  : '[underline]{\[\'api.backendless.com\'\]}',
                description: 'Backendless URL Override'
            },
            {
                name       : 'dump',
                alias      : 'd',
                typeLabel  : '[underline]{\[./path-to-file.json\]}',
                description: 'Optional: Path to dump-file'
            },
            {
                name       : 'timeout',
                alias      : 't',
                typeLabel  : '[underline]{\[30000\]}',
                description: 'Default: 30000'
            },
            {
                name       : 'verbose',
                alias      : 'v',
                description: 'Enables move verbose logging output'
            },
            {
                name       : 'monitor',
                alias      : 'm',
                description: 'Enables monitor: returns 0 if identical, or 1 - if not'
            },
            {
                name       : 'sync',
                alias      : 's',
                description: 'Synchronize reference => compare app(s)'
            },
            {
                name       : 'check-list',
                alias      : 'l',
                description: `Space separated array of compare types: \n ${_.values(CheckList).join(' ')}`
            },
            {
                name       : 'silent',
                description: 'Enables silent mode for synchronization. Warning! All schema updates will make without user confirmation'
            }
        ]
    }
]
