import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, register as registerApi, getProfile } from '../api/user'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref(JSON.parse(localStorage.getItem('user_info') || 'null'))
  const accessToken = ref(localStorage.getItem('access_token') || '')

  const isLoggedIn = computed(() => !!accessToken.value)

  const setTokens = (access, refresh) => {
    accessToken.value = access
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
  }

  const setUserInfo = (info) => {
    userInfo.value = info
    localStorage.setItem('user_info', JSON.stringify(info))
  }

  const login = async (data) => {
    const res = await loginApi(data)
    setTokens(res.data.access, res.data.refresh)
    setUserInfo(res.data.user)
    return res
  }

  const register = async (data) => {
    const res = await registerApi(data)
    setTokens(res.data.access, res.data.refresh)
    setUserInfo(res.data.user)
    return res
  }

  const fetchProfile = async () => {
    const res = await getProfile()
    setUserInfo(res)
    return res
  }

  const logout = () => {
    accessToken.value = ''
    userInfo.value = null
    localStorage.clear()
  }

  return { userInfo, accessToken, isLoggedIn, login, register, fetchProfile, logout, setUserInfo }
})
