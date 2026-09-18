import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(data) {
  if (!data) return '-';
  return new Date(data).toLocaleDateString('pt-BR');
}

export default function FichaCliente() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [ficha, setFicha] = useState(null);
  const [reguaSugerida, setReguaSugerida] = useState(null);
  const [aba, setAba] = useState('titulos');
  const [titulosSelecionados, setTitulosSelecionados] = useState([]);
  const [novoEvento, setNovoEvento] = useState({ tipo: 'contato', descricao: '' });
  const [mensagem, setMensagem] = useState('');

  function carregar() {
    api.get(`/clientes/${id}`).then(({ data }) => setFicha(data));
    api.get(`/clientes/${id}/regua`).then(({ data }) => setReguaSugerida(data));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function alternarSelecaoTitulo(tituloId) {
    setTitulosSelecionados((prev) =>
      prev.includes(tituloId) ? prev.filter((t) => t !== tituloId) : [...prev, tituloId]
    );
  }

  async function encaminharJuridico() {
    if (titulosSelecionados.length === 0) return;
    await api.post(`/clientes/${id}/encaminhar-juridico`, { tituloIds: titulosSelecionados });
    setTitulosSelecionados([]);
    setMensagem('Cliente encaminhado ao jurídico.');
    carregar();
  }

  async function registrarEvento(e) {
    e.preventDefault();
    if (!novoEvento.descricao.trim()) return;
    await api.post(`/clientes/${id}/eventos`, novoEvento);
    setNovoEvento({ tipo: 'contato', descricao: '' });
    setMensagem('Evento registrado na timeline.');
    carregar();
  }

  async function recalcularScore() {
    await api.post(`/clientes/${id}/recalcular-score`);
    setMensagem('Score recalculado.');
    carregar();
  }

  if (!ficha) return <div>Carregando...</div>;
  const { cliente, contratos, timeline, casosJuridicos } = ficha;
  const podeEditar = ['admin', 'cobranca'].includes(usuario?.perfil);
  const podeRegistrarEvento = ['admin', 'cobranca', 'juridico'].includes(usuario?.perfil);

  return (
    <div>
      <div className="topo-pagina">
        <div>
          <h2>{cliente.nome}</h2>
          <div style={{ color: '#64748b', fontSize: 13 }}>Código ERP: {cliente.codigo_erp_cliente}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`badge ${cliente.faixa_prioridade}`} style={{ fontSize: 14 }}>
            {cliente.faixa_prioridade} — score {cliente.score_atual}
          </span>
          {podeEditar && (
            <div style={{ marginTop: 8 }}>
              <button className="btn secundario" onClick={recalcularScore}>Recalcular score</button>
            </div>
          )}
        </div>
      </div>

      {mensagem && <div className="card" style={{ marginBottom: 16, background: '#ecfdf5' }}>{mensagem}</div>}

      {reguaSugerida?.etapaSugerida && (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>Régua de cobrança:</strong> cliente está com {reguaSugerida.diasAtraso} dia(s) de atraso — etapa
          sugerida: envio via <strong>{reguaSugerida.etapaSugerida.canal}</strong>
          {reguaSugerida.etapaSugerida.template_nome ? ` usando o template "${reguaSugerida.etapaSugerida.template_nome}"` : ''}.
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Disparo manual — a equipe de cobrança decide e registra o contato na timeline.
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={aba === 'titulos' ? 'ativo' : ''} onClick={() => setAba('titulos')}>Contratos e Títulos</button>
        <button className={aba === 'timeline' ? 'ativo' : ''} onClick={() => setAba('timeline')}>Timeline</button>
        <button className={aba === 'juridico' ? 'ativo' : ''} onClick={() => setAba('juridico')}>Jurídico</button>
      </div>

      {aba === 'titulos' && (
        <div>
          {podeEditar && titulosSelecionados.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              {titulosSelecionados.length} título(s) selecionado(s).{' '}
              <button className="btn" onClick={encaminharJuridico}>Encaminhar ao Jurídico</button>
            </div>
          )}
          {contratos.map((contrato) => (
            <div className="card" key={contrato.id} style={{ marginBottom: 16 }}>
              <h3>{contrato.empreendimento_nome} — Venda {contrato.numero_venda}</h3>
              <table>
                <thead>
                  <tr>
                    {podeEditar && <th></th>}
                    <th>Parcela</th>
                    <th>Vencimento</th>
                    <th>Valor original</th>
                    <th>Valor atualizado</th>
                    <th>Status</th>
                    <th>Fundo</th>
                  </tr>
                </thead>
                <tbody>
                  {contrato.titulos.map((t) => (
                    <tr key={t.id}>
                      {podeEditar && (
                        <td>
                          {t.status === 'aberto' && (
                            <input
                              type="checkbox"
                              checked={titulosSelecionados.includes(t.id)}
                              onChange={() => alternarSelecaoTitulo(t.id)}
                            />
                          )}
                        </td>
                      )}
                      <td>{t.numero_parcela}</td>
                      <td>{formatarData(t.vencimento)}</td>
                      <td>{formatarMoeda(t.valor_original)}</td>
                      <td>{formatarMoeda(t.valor_atualizado)}</td>
                      <td><span className={`badge status-${t.status}`}>{t.status}</span></td>
                      <td>{t.fundo_nome || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {aba === 'timeline' && (
        <div>
          {podeRegistrarEvento && (
            <form className="card" onSubmit={registrarEvento} style={{ marginBottom: 16 }}>
              <div className="form-linha">
                <label>Tipo de evento</label>
                <select value={novoEvento.tipo} onChange={(e) => setNovoEvento({ ...novoEvento, tipo: e.target.value })}>
                  <option value="contato">Contato</option>
                  <option value="negociacao">Negociação</option>
                  <option value="movimentacao">Movimentação</option>
                  <option value="judicial">Judicial</option>
                </select>
              </div>
              <div className="form-linha">
                <label>Descrição</label>
                <textarea
                  rows={3}
                  value={novoEvento.descricao}
                  onChange={(e) => setNovoEvento({ ...novoEvento, descricao: e.target.value })}
                />
              </div>
              <button className="btn" type="submit">Registrar</button>
            </form>
          )}
          <div className="card">
            {timeline.length === 0 && <p>Sem eventos registrados.</p>}
            {timeline.map((evento) => (
              <div className="timeline-item" key={evento.id}>
                <div className="meta">
                  {formatarData(evento.data)} — {evento.tipo} {evento.autor_nome ? `— ${evento.autor_nome}` : ''}
                </div>
                <div>{evento.descricao}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {aba === 'juridico' && (
        <div className="card">
          {casosJuridicos.length === 0 && <p>Nenhum caso jurídico para este cliente.</p>}
          <table>
            <thead>
              <tr><th>Status</th><th>Nº Processo</th><th>Encaminhado em</th><th>Observações</th></tr>
            </thead>
            <tbody>
              {casosJuridicos.map((caso) => (
                <tr key={caso.id}>
                  <td>{caso.status}</td>
                  <td>{caso.numero_processo || '-'}</td>
                  <td>{formatarData(caso.data_encaminhamento)}</td>
                  <td>{caso.observacoes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
