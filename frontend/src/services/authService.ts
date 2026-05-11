import api from './axiosInstance'

export const authService = {
  login: async (email: string, mot_de_passe: string) => {
    const res = await api.post('/auth/login', { email, mot_de_passe })
    return res.data
  },
}