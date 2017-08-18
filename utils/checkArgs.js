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
	const argNotZero = _.gt(options[optionKey],0);
	let announce = (
	  console.log(chalk.bgYellow.red('Missing arguments, see help below'))
	)
        if (argNotSet) {
	  announce;
          console.log(chalk.green(help));
          process.exit(0);
        } else if (argEmpty && !options['timeout']) {
          announce;
          console.log(chalk.green(help));
          process.exit(0);
        } else if (options[optionKey] === 'timeout') {
             if (!argNotZero) {
               console.log(chalk.green('Specify timout greater that 0'));
               process.exit(0);
             }
        }
	  else {
            console.log(chalk.bgYellow.green('Executing Backendless Database Schema comparison tool....'));
            console.log(chalk.green(`.....Argument ${optionKey} is set as: ${options[optionKey]}!`));
            return true;
        }
    };
    
    return _.keys(options)
            .every(argIsValid);
});

module.exports = checkArgs;
