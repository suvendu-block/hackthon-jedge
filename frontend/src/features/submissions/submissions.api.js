import api from '@/features/shared/api/client.js';

// nested under an event for create/list
export const listSubmissions = async (eventId) =>
    (await api.get(`/events/${eventId}/submissions`)).data;
export const createSubmission = async (eventId, body) =>
    (await api.post(`/events/${eventId}/submissions`, body)).data;

// standalone by id for open/edit/withdraw
export const getSubmission = async (id) => (await api.get(`/submissions/${id}`)).data;
export const updateSubmission = async (id, body) => (await api.put(`/submissions/${id}`, body)).data;
export const deleteSubmission = async (id) => (await api.delete(`/submissions/${id}`)).data;
