import api from '@/features/shared/api/client.js';

// nested under an event for create/list
export const listSubmissions = async (eventId) =>
    (await api.get(`/events/${eventId}/submissions`)).data;
export const createSubmission = async (eventId, body) =>
    (await api.post(`/events/${eventId}/submissions`, body)).data;

// standalone by id for open/edit/withdraw
export const getSubmission = async (id) => (await api.get(`/submissions/${id}`)).data;
export const updateSubmission = async (id, body) =>
    (await api.put(`/submissions/${id}`, body)).data;
export const deleteSubmission = async (id) => (await api.delete(`/submissions/${id}`)).data;

// ---- Phase 7: evidence depth -------------------------------------------------
// repository grant (team authorization, recorded), server-fetched insight,
// document uploads, demo liveness checks.

export const getRepoGrant = async (id) => (await api.get(`/submissions/${id}/repo/grant`)).data;
export const grantRepo = async (id, body) => (await api.post(`/submissions/${id}/repo/grant`, body)).data;
export const revokeRepo = async (id) => (await api.delete(`/submissions/${id}/repo/grant`)).data;

export const getInsight = async (id) => (await api.get(`/submissions/${id}/repo/insight`)).data;
export const refreshInsight = async (id) => (await api.post(`/submissions/${id}/repo/insight`, {})).data;

export const listDocuments = async (id) => (await api.get(`/submissions/${id}/documents`)).data;
export const uploadDocument = async (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return (await api.post(`/submissions/${id}/documents`, form)).data;
};
export const removeDocument = async (id, docId) =>
    (await api.delete(`/submissions/${id}/documents/${docId}`)).data;
export const documentBlob = async (id, docId) =>
    (await api.get(`/submissions/${id}/documents/${docId}/download`, { responseType: 'blob' })).data;

export const checkDemo = async (id) => (await api.post(`/submissions/${id}/demo/check`, {})).data;
export const getDemoCheck = async (id) => (await api.get(`/submissions/${id}/demo/check`)).data;
