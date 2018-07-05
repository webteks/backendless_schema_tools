const ansi = require('ansi-escape-sequences');
const chalk = require('chalk');
const package = require('../../package.json');

module.exports = [
    {
        header: 'Backendless Schema Comparison',
        group: ['header','_none'],
        content: 'By: Charles Russell (charles.russell@webteks.com)\r\nJohn Pribesh (john.pribesh@webteks.com)\r\nJohn Vernon (john.vernon@webteks.com)\r\nVitaly Vengrov (vitaly.vengrov@webteks.com)',
	content: 'Version: ' + package.version
    }
]
