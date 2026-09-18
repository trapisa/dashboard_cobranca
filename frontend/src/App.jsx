import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RotaProtegida from './components/RotaProtegida';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import FichaCliente from './pages/FichaCliente';
import Importacao from './pages/Importacao';
import Juridico from './pages/Juridico';
import ConfigRegua from './pages/ConfigRegua';
import ConfigScore from './pages/ConfigScore';
import ConfigUsuarios from './pages/ConfigUsuarios';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <RotaProtegida>
                <Layout />
              </RotaProtegida>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<FichaCliente />} />
            <Route
              path="importacao"
              element={
                <RotaProtegida perfis={['admin', 'diretoria']}>
                  <Importacao />
                </RotaProtegida>
              }
            />
            <Route
              path="juridico"
              element={
                <RotaProtegida perfis={['admin', 'juridico', 'diretoria']}>
                  <Juridico />
                </RotaProtegida>
              }
            />
            <Route
              path="configuracoes/regua"
              element={
                <RotaProtegida perfis={['admin']}>
                  <ConfigRegua />
                </RotaProtegida>
              }
            />
            <Route
              path="configuracoes/score"
              element={
                <RotaProtegida perfis={['admin']}>
                  <ConfigScore />
                </RotaProtegida>
              }
            />
            <Route
              path="configuracoes/usuarios"
              element={
                <RotaProtegida perfis={['admin']}>
                  <ConfigUsuarios />
                </RotaProtegida>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
