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

// AI draft — optional helper the judge can accept, override, or ignore
export const requestAnalysis = async (submissionId) =>
    (await api.post(`/submissions/${submissionId}/ai-analysis`)).data;
export const getAnalysis = async (submissionId) =>
    (await api.get(`/submissions/${submissionId}/ai-analysis`)).data;
