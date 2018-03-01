

const baseUrl = appId => `${appId}/console/data/tables`

module.exports = (request, appId) => {
  const baseUrl = baseUrl(appId)
  return {
    addTable(appId, name) {
      return request.post(`${baseUrl}`, {name})
    },
    updateTable(appId, name) {
      return request.put(`${baseUrl}`, {name})
    },
    removeTable(appId, name) {
      return request.delete(`${baseUrl}/${name}`)
    },

    addColumn(appId, table, column) {
      return request.post(`${baseUrl}/${table}/columns`, column)
    },
    updateColumn(appId, table, columnName, column) {
      return request.put(`${baseUrl}/${table}/columns/${columnName}`, column)
    },
    removeColumn(appId, table, columnName) {
      return request.delete(`${baseUrl}/${table}/columns/${columnName}`)
    },

    addRelation(appId, table, relation) {
      return request.post(`${baseUrl}/${table}/columns/relation`, relation)
    },
    updateRelation(appId, table, columnName, relation) {
      return request.put(`${baseUrl}/${table}/columns/relation/${columnName}`, relation)
    },
    removeRelation(appId, table, columnName) {
      return request.delete(`${baseUrl}/${table}/columns/relation/${columnName}`)
    },
  }
}

