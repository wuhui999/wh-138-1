import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.detail || error.message || '请求失败'
    return Promise.reject(new Error(message))
  }
)

export const userApi = {
  list: (role) => api.get('/users', { params: { role } }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
}

export const projectApi = {
  list: (status) => api.get('/projects', { params: { status } }),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  remove: (id) => api.delete(`/projects/${id}`),
  gantt: (id) => api.get(`/projects/${id}/gantt`),
}

export const processApi = {
  list: (params) => api.get('/processes', { params }),
  tree: (projectId) => api.get('/processes/tree', { params: { project_id: projectId } }),
  get: (id) => api.get(`/processes/${id}`),
  create: (data) => api.post('/processes', data),
  update: (id, data) => api.put(`/processes/${id}`, data),
  remove: (id) => api.delete(`/processes/${id}`),
  delayed: () => api.get('/processes/delayed/list'),
  addDependency: (procId, data) => api.post(`/processes/${procId}/dependencies`, data),
  removeDependency: (procId, depId) => api.delete(`/processes/${procId}/dependencies/${depId}`),
}

export const partApi = {
  list: (params) => api.get('/purchases/parts', { params }),
  get: (id) => api.get(`/purchases/parts/${id}`),
  create: (data) => api.post('/purchases/parts', data),
  update: (id, data) => api.put(`/purchases/parts/${id}`, data),
}

export const purchaseApi = {
  list: (params) => api.get('/purchases', { params }),
  get: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post('/purchases', data),
  update: (id, data) => api.put(`/purchases/${id}`, data),
  remove: (id) => api.delete(`/purchases/${id}`),
  overdue: () => api.get('/purchases/overdue/list'),
  markArrived: (itemId, qty) => api.put(`/purchases/items/${itemId}/arrive`, {}, { params: { arrived_quantity: qty } }),
}

export const inspectionApi = {
  list: (params) => api.get('/inspections', { params }),
  get: (id) => api.get(`/inspections/${id}`),
  create: (data) => api.post('/inspections', data),
  update: (id, data) => api.put(`/inspections/${id}`, data),
  remove: (id) => api.delete(`/inspections/${id}`),
  pending: () => api.get('/inspections/pending/list'),
  failed: () => api.get('/inspections/failed/list'),
}

export const riskApi = {
  all: () => api.get('/risks'),
  byType: (type) => api.get(`/risks/type/${type}`),
}

export const statsApi = {
  overview: () => api.get('/stats/overview'),
  delayReasons: () => api.get('/stats/delay-reasons'),
  shortageRate: () => api.get('/stats/shortage-rate'),
  projectProgress: () => api.get('/stats/project-progress'),
  teamWorkload: () => api.get('/stats/team-workload'),
}

export default api
