import request from './request'

export const login = (data) => request.post('/users/login/', data)
export const register = (data) => request.post('/users/register/', data)
export const getProfile = () => request.get('/users/profile/')
export const updateProfile = (data) => request.patch('/users/profile/', data)
export const changePassword = (data) => request.post('/users/change-password/', data)
