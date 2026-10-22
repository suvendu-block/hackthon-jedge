import api from '@/features/shared/api/client.js';

export const getLeaderboard = async (id) =>
    (await api.get(`/events/${id}/leaderboard`)).data;

export const releaseResults = async (id) =>
    (await api.post(`/events/${id}/leaderboard/release`)).data;

// pull the CSV as a blob so the bearer token rides along — a plain
// <a href> would land at the API tokenless and bounce to the login wall
export const downloadResults = async (id) => {
    const res = await api.get(`/events/${id}/leaderboard/csv`, { responseType: 'blob' });

    // the server names the file; fall back if the header is missing
    const disposition = res.headers?.['content-disposition'] || '';
    const named = disposition.match(/filename="?([^"]+)"?/);

    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = named?.[1] || 'results.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // give the browser a moment to start the download before freeing the blob
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
