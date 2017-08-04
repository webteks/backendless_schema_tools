const _ = require('lodash');
const chalk = require('chalk');
const Promise = require('bluebird');
const getUsage = require('command-line-usage');
const helpFile = require('../constants/command-help');

const help = getUsage(helpFile);

const checkArgs = Promise.method(options => {
    const argIsValid = optionKey => {
        process.stdout.write(chalk.white(`.....Verifying argument ${optionKey} exists - `));
        const argNotSet = !options[optionKey];
        const argEmpty = _.isEmpty(options[optionKey]);
	let announce = (
	  console.log(chalk.bgYellow.red('Missing arguments, see help below'))
	)
        if (argNotSet) {
	  announce;
          console.log(chalk.green(help));
          process.exit(0);
        } else if (argEmpty) {
          announce;
          console.log(chalk.green(help));
          process.exit(0);
        } else {
            console.log(chalk.bgYellow.green('Executing Backendless Database Schema comparison tool....'));
            console.log(chalk.green(`.....Argument ${optionKey} is set as: ${options[optionKey]}!`));
            return true;
        }
    };
    
    return _.keys(options)
            .every(argIsValid);
});

module.exports = checkArgs;
