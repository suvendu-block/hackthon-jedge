import axios from 'axios';



const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});




// attach jwt on every request
// (localStorage key must match exactly what AuthContext writes: "token")
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if(token) config.headers.Authorization = `Bearer ${token}`;
    return config;
})




/// on 401 -> clear session , send to login
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href ="/login";
        }
        return Promise.reject(err);

    }
)



export default api;