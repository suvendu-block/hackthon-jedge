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

// ---- Phase 7: evidence panel -------------------------------------------------
// server-fetched artifacts (repo insight, documents, demo check) plus the
// judge's own criterion-linked notes — BL-11.

export const getInsight = async (submissionId) =>
    (await api.get(`/submissions/${submissionId}/repo/insight`)).data;
export const refreshInsight = async (submissionId) =>
    (await api.post(`/submissions/${submissionId}/repo/insight`, {})).data;
export const listDocuments = async (submissionId) =>
    (await api.get(`/submissions/${submissionId}/documents`)).data;
export const documentBlob = async (submissionId, docId) =>
    (await api.get(`/submissions/${submissionId}/documents/${docId}/download`, { responseType: 'blob' })).data;
export const getDemoCheck = async (submissionId) =>
    (await api.get(`/submissions/${submissionId}/demo/check`)).data;
export const checkDemo = async (submissionId) =>
    (await api.post(`/submissions/${submissionId}/demo/check`, {})).data;

export const listEvidence = async (submissionId) =>
    (await api.get(`/submissions/${submissionId}/evidence`)).data;
export const addEvidence = async (submissionId, body) =>
    (await api.post(`/submissions/${submissionId}/evidence`, body)).data;
export const deleteEvidence = async (submissionId, evidenceId) =>
    (await api.delete(`/submissions/${submissionId}/evidence/${evidenceId}`)).data;
