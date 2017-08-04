const ansi = require('ansi-escape-sequences');
const header = require('../assets/ansi-header.js');
const chalk = require('chalk');

/**
 * This is the banner splash screen, displayed once.
 * @type {*[]}
 */
 /*
  name: 'banner',
  description: 'Prints nifty webteks banner.'
  */
module.exports = [
    {
        content: chalk.green(ansi.format(header)),
        raw: true
    },
    {
        header: 'Backendless helper utility',
        group: ['header','_none'],
        content: 'By: Charles Russell (charles.russell@webteks.com)\r\nJohn Pribesh (john.pribesh@webteks.com)'
    }
]
