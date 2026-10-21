import { createContext , useContext , useState } from 'react';
import api from '../api/clients.js';



const AuthContext = createContext(null);


export function AuthProvider({children}) {
    const [user,setUser] = useState(() => {
        const stored = localStorage.getItem("user");
        return stored ? JSON.parse(stored) : null;
    });


    // login 
    const login = async ({emila, password}) => {
        // restore on every refresh
        const {data}  = await api.post("/auth/login",{email,password});



        // return to backend 
        localStorage.setItem("token",data.token);
        localStorage.setItem("user",JSON.stringify({
            _id: data._id,
            name: data.name,
            email: data.email,
            role: data.role
        }));
        setUser({
            _id: data._id,
            name: data.name,
            email: data.email,
            role: data.email
        });
        return data;
    }


    // logout
    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
    };



    return (
        <AuthContext.Provider value={{user,login,logout}}>
            {children}
        </AuthContext.Provider>
    )
}







// use this hook anywhere : Now
export const useAuth = () => useContext(AuthContext);