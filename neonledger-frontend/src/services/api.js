import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nl_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nl_token')
      localStorage.removeItem('nl_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
}

export const transactionsAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  remove: (id) => api.delete(`/transactions/${id}`),
  summary: () => api.get('/transactions/summary'),
  resetAll: () => api.delete('/transactions/reset-all'),
  importCSV: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/transactions/import-csv', form)
  },
}

export const aiAPI = {
  categorize: (description) => api.post('/ai/categorize', { description }),
  insights: () => api.get('/ai/insights'),
  tips: () => api.get('/ai/tips'),
  predict: () => api.get('/ai/predict'),
  budgetInsights: (monthlyBudget) => api.post('/ai/budget-insights', { monthlyBudget }),
}

export const budgetsAPI = {
  getAll: () => api.get('/budgets'),
  upsert: (data) => api.post('/budgets', data),
  remove: (id) => api.delete(`/budgets/${id}`),
}

export default api
