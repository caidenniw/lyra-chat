import { AuthProvider } from './contexts/AuthContext';
import { AppShell } from './components/layout/AppShell';

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
