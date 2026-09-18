import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STATUS = ['encaminhado', 'protocolado', 'em_andamento', 'sentenca', 'execucao', 'acordo'];

function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

export default function Juridico() {
  const { usuario } = useAuth();
  const [casos, setCasos] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [edicoes, setEdicoes] = useState({});

  function carregar() {
    api.get('/juridico/casos', { params: { status: filtroStatus || undefined } }).then(({ data }) => setCasos(data.casos));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatus]);

  function aoEditarCampo(casoId, campo, valor) {
    setEdicoes((prev) => ({ ...prev, [casoId]: { ...prev[casoId], [campo]: valor } }));
  }

  async function salvar(casoId) {
    const edicao = edicoes[casoId];
    if (!edicao) return;
    await api.put(`/juridico/casos/${casoId}`, edicao);
    setEdicoes((prev) => ({ ...prev, [casoId]: undefined }));
    carregar();
  }

  const podeEditar = ['admin', 'juridico'].includes(usuario?.perfil);

  return (
    <div>
      <div className="topo-pagina">
        <h2>Módulo Jurídico</h2>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-linha" style={{ width: 240 }}>
          <label>Filtrar por status</label>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos</option>
            {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Cliente</th><th>Status</th><th>Nº Processo</th><th>Encaminhado em</th>
              <th>Observações</th>{podeEditar && <th></th>}
            </tr>
          </thead>
          <tbody>
            {casos.map((caso) => {
              const edicao = edicoes[caso.id] || {};
              return (
                <tr key={caso.id}>
                  <td>{caso.cliente_nome}</td>
                  <td>
                    {podeEditar ? (
                      <select
                        value={edicao.status ?? caso.status}
                        onChange={(e) => aoEditarCampo(caso.id, 'status', e.target.value)}
                      >
                        {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : caso.status}
                  </td>
                  <td>
                    {podeEditar ? (
                      <input
                        type="text"
                        value={edicao.numeroProcesso ?? caso.numero_processo ?? ''}
                        onChange={(e) => aoEditarCampo(caso.id, 'numeroProcesso', e.target.value)}
                      />
                    ) : (caso.numero_processo || '-')}
                  </td>
                  <td>{formatarData(caso.data_encaminhamento)}</td>
                  <td>
                    {podeEditar ? (
                      <input
                        type="text"
                        value={edicao.observacoes ?? caso.observacoes ?? ''}
                        onChange={(e) => aoEditarCampo(caso.id, 'observacoes', e.target.value)}
                      />
                    ) : (caso.observacoes || '-')}
                  </td>
                  {podeEditar && (
                    <td>
                      <button className="btn secundario" onClick={() => salvar(caso.id)} disabled={!edicoes[caso.id]}>
                        Salvar
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {casos.length === 0 && <tr><td colSpan={6}>Nenhum caso jurídico encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
