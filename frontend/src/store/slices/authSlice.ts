import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type Role =
  | 'ADMIN' | 'METHODISTE' | 'CHEF_POLE'
  | 'CHEF_EQUIPE' | 'MECANICIEN' | 'TECHNICIEN' | 'HSE'

export interface AuthUser {
  id_user        : number
  nom            : string
  prenom         : string
  role           : Role
  identifiant    : string
  email          : string
  id_pole        : number | null
  id_equipe      : number | null
  nom_pole       : string | null
  nom_equipe     : string | null
  genre          : string
  date_embauche  : string
  date_naissance : string
  telephone      : string | null
  photo_url      : string | null
}

interface AuthState {
  user        : AuthUser | null
  accessToken : string | null
  isLoggedIn  : boolean
}

const initialState: AuthState = {
  user       : null,
  accessToken: null,
  isLoggedIn : false,
}

function normalizeUser(u: AuthUser): AuthUser {
  u.id_user  = Number(u.id_user)
  if (u.id_pole)   u.id_pole   = Number(u.id_pole)
  if (u.id_equipe) u.id_equipe = Number(u.id_equipe)
  if (u.role)      u.role      = u.role.replace('RoleEnum.', '').replace('GenreEnum.', '') as Role
  return u
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: AuthUser; token: string }>) => {
      const u = normalizeUser(action.payload.user)
      state.user        = u
      state.accessToken = action.payload.token
      state.isLoggedIn  = true
      localStorage.setItem('token', action.payload.token)
      localStorage.setItem('user',  JSON.stringify(u))
    },

    updateUser: (state, action: PayloadAction<Partial<AuthUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
        localStorage.setItem('user', JSON.stringify(state.user))
      }
    },

    logout: (state) => {
      state.user        = null
      state.accessToken = null
      state.isLoggedIn  = false
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },

    loadFromStorage: (state) => {
      try {
        const token = localStorage.getItem('token')
        const raw   = localStorage.getItem('user')
        if (token && raw) {
          const u = normalizeUser(JSON.parse(raw) as AuthUser)
          state.accessToken = token
          state.user        = u
          state.isLoggedIn  = true
        }
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    },
  },
})

export const { setCredentials, updateUser, logout, loadFromStorage } = authSlice.actions
export default authSlice.reducer