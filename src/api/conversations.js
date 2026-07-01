import request from '@/utils/request'

export function fetchConversations() {
  return request.get('/api/conversations')
}

export function saveConversation(data) {
  return request.post('/api/conversations', data)
}

export function deleteConversation(id) {
  return request.delete(`/api/conversations/${id}`)
}
