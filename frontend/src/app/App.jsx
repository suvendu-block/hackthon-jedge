import {BrowserRouter,Routes,Navigate, Route} from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext.jsx';
import Login from '@/features/auth/Login.jsx';
import Register from '@/features/auth/Register.jsx';
import Dashboard from './Dashboard.jsx';
import EventsPage from '@/features/events/EventsPage.jsx';
import SubmissionsPage from '@/features/submissions/SubmissionsPage.jsx';
import ScorecardPage from '@/features/judging/ScorecardPage.jsx';
import LeaderboardPage from '@/features/leaderboard/LeaderboardPage.jsx';



 // guard: only logged-in users pass, everyone else goes to /login
function ProtectedRoute({ children}) {
   const {user} = useAuth();
   if (!user) return <Navigate to="/login" replace />
   return children;
 }


 export default function App() {
   return (
     <AuthProvider>
       <BrowserRouter>
       <Routes>
         <Route path='/login' element={<Login />} />
         <Route path='/register' element={<Register />} />

        <Route
          path='/'
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path='/events'
          element={
            <ProtectedRoute>
              <EventsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path='/events/:eventId/submissions'
          element={
            <ProtectedRoute>
              <SubmissionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path='/events/:eventId/leaderboard'
          element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path='/scorecard/:submissionId'
          element={
            <ProtectedRoute>
              <ScorecardPage />
            </ProtectedRoute>
          }
        />
        <Route path='*' element={<Navigate to="/" replace />} />
      </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

