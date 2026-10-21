import React from 'react';
import {BrowserRouter,Routes,Navigate, Route} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContex.jsx';
import Login from './page/Login.jsx';
import "./App.css"



// guard: only 
function ProectedRoute({ children}) {
  const {user} = useAuth();
  if (!user) return <Navigate to="/login" replace />
  return children;
}


/// hashboard
function Dashboard() {
  const {user,logout} = useAuth();

  return (
    <main style={{padding: 40,fontFamily: 'system-ui'}}>
      <h1>HackJudge</h1>
      <p>Welcome, <b>{user.name}</b> -role: <b>{user.role}</b></p>
      <button onClick={logout} style={{ padding: "8px 16px"}}>
        Log Out
      </button>
    </main>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
      <Routes>
        <Route path='/login' element={<Login />} />

        <Route
          path='/'
          element={
            <ProectedRoute>
              <Dashboard />
            </ProectedRoute>
          }
        />
        <Route path='*' element={<Navigate to="/" replace />} />
      </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

