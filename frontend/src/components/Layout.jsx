import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ITENS_MENU = [
  { rota: '/', label: 'Dashboard', perfis: ['admin', 'cobranca', 'juridico', 'diretoria'] },
  { rota: '/clientes', label: 'Clientes', perfis: ['admin', 'cobranca', 'juridico', 'diretoria'] },
  { rota: '/importacao', label: 'Importação', perfis: ['admin', 'diretoria'] },
  { rota: '/juridico', label: 'Jurídico', perfis: ['admin', 'juridico', 'diretoria'] },
  { rota: '/configuracoes/regua', label: 'Régua de Cobrança', perfis: ['admin'] },
  { rota: '/configuracoes/score', label: 'Score', perfis: ['admin'] },
  { rota: '/configuracoes/usuarios', label: 'Usuários', perfis: ['admin'] },
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function sair() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h1>Trapisa</h1>
        <div className="subtitulo">CRM de Cobrança</div>
        <nav>
          {ITENS_MENU.filter((item) => item.perfis.includes(usuario?.perfil)).map((item) => (
            <NavLink
              key={item.rota}
              to={item.rota}
              className={({ isActive }) => (isActive ? 'ativo' : '')}
              end={item.rota === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 32, fontSize: 12, color: '#94a3b8' }}>
          <div>{usuario?.nome}</div>
          <div style={{ marginBottom: 10 }}>Perfil: {usuario?.perfil}</div>
          <button className="btn secundario" style={{ width: '100%' }} onClick={sair}>
            Sair
          </button>
        </div>
      </aside>
      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  );
}
