import api from './axiosInstance'

export interface ModeleML {
  id_modele     : number
  version       : string
  type_modele   : 'LSTM' | 'GRU'
  nom           : string
  description   : string | null
  path_keras    : string
  path_scaler_x : string
  path_scaler_y : string
  is_active     : boolean
  uploaded_by   : number
  uploaded_at   : string
}

export interface UploadModeleParams {
  version      : string
  type_modele  : 'LSTM' | 'GRU'
  nom          : string
  description ?: string
  model_keras  : File
  scaler_x     : File
  scaler_y     : File
}

export const modelesMLService = {
  lister: async (): Promise<ModeleML[]> => {
    const res = await api.get('/modeles-ml')
    return res.data
  },

  upload: async (data: UploadModeleParams): Promise<ModeleML> => {
    const form = new FormData()
    form.append('version',     data.version)
    form.append('type_modele', data.type_modele)
    form.append('nom',         data.nom)
    if (data.description) form.append('description', data.description)
    form.append('model_keras', data.model_keras)
    form.append('scaler_x',    data.scaler_x)
    form.append('scaler_y',    data.scaler_y)

    const res = await api.post('/modeles-ml/upload', form, {
      headers : { 'Content-Type': 'multipart/form-data' },
      timeout : 5 * 60_000,   // 5 min : les fichiers peuvent être lourds
    })
    return res.data
  },

  activer: async (id_modele: number): Promise<ModeleML> => {
    const res = await api.post(`/modeles-ml/${id_modele}/activer`)
    return res.data
  },

  supprimer: async (id_modele: number): Promise<void> => {
    await api.delete(`/modeles-ml/${id_modele}`)
  },
}
