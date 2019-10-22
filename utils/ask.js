'use strict'

module.exports = question => {
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    })

    return new Promise(resolve => {
        rl.question(`${question}`, answer => {
            rl.close()

            resolve(answer)
        })
    })
}