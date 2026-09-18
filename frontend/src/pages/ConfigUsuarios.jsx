import { useEffect, useState } from 'react';
import api from '../services/api';

const PERFIS = ['admin', 'cobranca', 'juridico', 'diretoria'];

export default function ConfigUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [novo, setNovo] = useState({ nome: '', email: '', senha: '', perfil: 'cobranca' });
  const [erro, setErro] = useState('');

  function carregar() {
    api.get('/usuarios').then(({ data }) => setUsuarios(data.usuarios));
  }

  useEffect(() => { carregar(); }, []);

  async function criar(e) {
    e.preventDefault();
    setErro('');
    try {
      await api.post('/usuarios', novo);
      setNovo({ nome: '', email: '', senha: '', perfil: 'cobranca' });
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao criar usuário.');
    }
  }

  async function alternarAtivo(usuario) {
    await api.put(`/usuarios/${usuario.id}`, { ativo: !usuario.ativo });
    carregar();
  }

  return (
    <div>
      <div className="topo-pagina"><h2>Usuários</h2></div>

      <div className="card" style={{ marginBottom: 16 }}>
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ativo</th><th></th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nome}</td>
                <td>{u.email}</td>
                <td>{u.perfil}</td>
                <td>{u.ativo ? 'Sim' : 'Não'}</td>
                <td><button className="btn secundario" onClick={() => alternarAtivo(u)}>{u.ativo ? 'Desativar' : 'Ativar'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Novo usuário</h3>
        <form onSubmit={criar}>
          <div className="form-linha">
            <label>Nome</label>
            <input type="text" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required />
          </div>
          <div className="form-linha">
            <label>E-mail</label>
            <input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} required />
          </div>
          <div className="form-linha">
            <label>Senha provisória</label>
            <input type="password" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} required />
          </div>
          <div className="form-linha">
            <label>Perfil</label>
            <select value={novo.perfil} onChange={(e) => setNovo({ ...novo, perfil: e.target.value })}>
              {PERFIS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {erro && <div className="erro-msg">{erro}</div>}
          <button className="btn" type="submit">Criar usuário</button>
        </form>
      </div>
    </div>
  );
}
