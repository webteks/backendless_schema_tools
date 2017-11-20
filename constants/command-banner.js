const ansi = require('ansi-escape-sequences');
const chalk = require('chalk');
const package = require('../package.json');
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
        header: 'Backendless helper utility',
        group: ['header','_none'],
        content: 'By: Charles Russell (charles.russell@webteks.com)\r\nJohn Pribesh (john.pribesh@webteks.com)',
	content: 'Version: ' + package.version
    }
]
