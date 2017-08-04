let instance

function Reporter(sourceApp,applications){
    if (instance === undefined) {
        instance = this
    }

    if (sourceApp === undefined) {
        throw new Error('Missing source application defined for comparisons')
    } else {
        instance.sourceApp = sourceApp
    }

    if (applications === undefined || applications.length <1){
        throw new Error('Missing applications array to compare against source Application')
    } else {
        instance.applications = applications
    }
}


function filterForMissingItems(source,compareTo, key, value) {
    let reportedMissingItems = []
    let missingItems = source.filter((elem,index,array)=>{
        compareTo.forEach((item,index,array)=>{
            if (elem[key] == value) {

            }
             if (elem.name == item.name) {
                 if (reportedMissingItems.indexOf(item.name) == -1) {
                     reportedMissingItems.push(elem)
                     return elem
                 }
             }
             if (index === array.length -1) {
                 return reportedMissingItems
             }
        })
    })
}

Reporter.prototype.filterForMissingItems = filterForMissingItems
module.exports = Reporter