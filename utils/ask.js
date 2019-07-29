'use strict'

const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout})

module.exports = question =>  {
    return new Promise(resolve => {
        rl.question(`${question}`, answer => {
            resolve(answer)
        })
    })
}