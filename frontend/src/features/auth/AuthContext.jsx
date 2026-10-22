import { createContext , useContext , useState } from 'react';
import api from '@/features/shared/api/client.js';



const AuthContext = createContext(null);


export function AuthProvider({children}) {
    const [user,setUser] = useState(() => {
        const stored = localStorage.getItem("user");
        return stored ? JSON.parse(stored) : null;
    });


    // login 
    const login = async ({email, password}) => {
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
            role: data.role
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







// the hook for reading it — keeping it here avoids a second file just for this
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);