import request from './request'

export const getPublicKbCategories = () => request.get('/knowledge/public/categories/')
export const getPublicKbColumnArticles = (columnId, params) =>
  request.get(`/knowledge/public/columns/${columnId}/articles/`, { params })
export const getPublicKbArticle = (id) => request.get(`/knowledge/public/articles/${id}/`)
export const searchPublicKbArticles = (params) => request.get('/knowledge/public/search/', { params })

// apifox 风格一次性返回完整文档树
export const getPublicKbTree = () => request.get('/knowledge/public/tree/')
