const _ = require('lodash');
const chalk = require('chalk');
const getUsage = require('command-line-usage');
const helpFile = require('../constants/command-help');

const help = getUsage(helpFile);

const checkArgs = options => {
    const argIsValid = optionKey => {
        const argNotSet = !options[optionKey];
        const argEmpty = _.isEmpty(options[optionKey]);
        const argNotZero = _.gt(options[optionKey], 0);
        if (argNotSet) {
            console.log(chalk.green(help));
            process.exit(0);
        } else if (argEmpty && !options['timeout']) {
            console.log(chalk.green(help));
            process.exit(0);
        } else if (options[optionKey] === 'timeout') {
            if (!argNotZero) {
                console.log(chalk.green('Specify timout greater that 0'));
                process.exit(0);
            }
        }
        else {

            if (options['verbose']){
                if (!(optionKey === 'password' || optionKey === 'username')) {
                    console.log(chalk.green(`.....Argument ${optionKey} is set as: ${options[optionKey]}!`));
                };
            };
            return true;
        }
    };

    return _.keys(options)
        .every(argIsValid);
};

module.exports = checkArgs;
