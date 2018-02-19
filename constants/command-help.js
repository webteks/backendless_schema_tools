const ansi = require('ansi-escape-sequences')

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
                name       : 'backendless-url',
                alias      : 'b',
                typeLabel  : '[underline]{\[\'api.backendless.com\'\]}',
                description: 'Backendless URL Override'
            },
            {
                name       : 'application-control',
                alias      : 'r',
                typeLabel  : '[underline]{\[\'live (Reference) \'\]}',
                description: 'Required: Reference Backendless Application name or path to dump-file'
            },
            {
                name       : 'applications-to-check',
                alias      : 'c',
                typeLabel  : '[underline]{\[\'dev (Comparison)\'\]}',
                description: 'Required: Space seperated array of application names or paths to compare ie: dev alpha'
            },
            {
                name       : 'dump-application-control',
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
                description: 'enables move verbose logging output'
            },
            {
                name       : 'monitor',
                alias      : 'm',
                description: 'enables monitor: return 0 if schemas are dentical, or 1 - if not'
            }
        ]
    }
]
