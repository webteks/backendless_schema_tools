module.exports = [
    { name: 'compare', alias: 'x', type: Boolean , group: 'compare' },
    { name: 'application-control', alias: 'r', type: String, group: 'compare',defaultValue: ''},
    { name: 'applications-to-check', alias: 'c', type: String, defaultValue: [], multiple: true, group: 'compare'},
    { name: 'username', alias: 'u', type: String, group: 'compare', defaultValue: ''},
    { name: 'password', alias: 'p', type: String, group: 'compare', defaultValue: ''},
    { name: 'reporting-directory', alias: 'o', type: String, defaultValue: process.cwd(), group: 'compare'},
    { name: 'backendless-version', alias: 'v', type: String, defaultValue: '3.1.0', group: 'compare'},
    { name: 'timeout', alias: 't', type: Number, group: 'compare', defaultValue: 30000}
];
