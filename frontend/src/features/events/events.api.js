import api from '@/features/shared/api/client.js';

// thin wrappers — pages never call axios directly
export const listEvents = async () => (await api.get('/events')).data;
export const getEvent = async (id) => (await api.get(`/events/${id}`)).data;
export const createEvent = async (body) => (await api.post('/events', body)).data;
export const updateEvent = async (id, body) => (await api.put(`/events/${id}`, body)).data;
export const deleteEvent = async (id) => (await api.delete(`/events/${id}`)).data;

export const addJudge = async (eventId, judgeId) =>
    (await api.post(`/events/${eventId}/judges`, { judgeId })).data;
export const removeJudge = async (eventId, judgeId) =>
    (await api.delete(`/events/${eventId}/judges/${judgeId}`)).data;

// judge directory, for the assign dropdown (organizer only)
export const listJudges = async () => (await api.get('/users/judges')).data;
