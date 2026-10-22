import api from '@/features/shared/api/client.js';

// scorecard for one submission (judge)
export const getScorecard = async (submissionId) =>
    (await api.get(`/evaluations/submission/${submissionId}`)).data;
export const saveDraft = async (submissionId, body) =>
    (await api.put(`/evaluations/submission/${submissionId}`, body)).data;
export const submitEvaluation = async (submissionId, body) =>
    (await api.post(`/evaluations/submission/${submissionId}/submit`, body)).data;

// my queue of scorecards
export const myEvaluations = async () => (await api.get('/evaluations/mine')).data;
