const _ = require('lodash');
const Promise = require('bluebird');
const fs = require('fs');

Promise.promisifyAll(fs);

function getDate() {
    const now = new Date();
    return `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}`;
}

function writeAppDataToFile(apps, path) {
    const date = getDate();
    let pathName = path;
    if (_.includes(path, '.')) {
        pathName = path.split('.')[-1];
    }
    return Promise.all(
        _(apps)
         .flattenDeep()
         .map(app => fs.writeFileAsync(
             `${app.appName}-${pathName}_${date}.json`,
             JSON.stringify(_.get(app, path), null, 4)
         ))
         .value()
    );
}

function writeDiffsToFile(diffObj) {
    return Promise.all(
        _.map(diffObj, (diff, appName) => {
            const date = getDate();
            return fs.writeFileAsync(`${appName}-diff_${date}.json`, JSON.stringify(diff, null, 4));
        })
    );
}


module.exports = {
    getDate,
    writeAppDataToFile,
    writeDiffsToFile
};
