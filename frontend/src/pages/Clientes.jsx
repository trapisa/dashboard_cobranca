import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [faixa, setFaixa] = useState('');
  const [carregando, setCarregando] = useState(true);

  function carregar() {
    setCarregando(true);
    api
      .get('/clientes', { params: { busca: busca || undefined, faixa: faixa || undefined } })
      .then(({ data }) => setClientes(data.clientes))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aoBuscar(e) {
    e.preventDefault();
    carregar();
  }

  return (
    <div>
      <div className="topo-pagina">
        <h2>Clientes</h2>
      </div>

      <form className="card" onSubmit={aoBuscar} style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'end' }}>
        <div className="form-linha" style={{ flex: 1, marginBottom: 0 }}>
          <label>Buscar por nome ou código</label>
          <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="form-linha" style={{ width: 200, marginBottom: 0 }}>
          <label>Faixa de prioridade</label>
          <select value={faixa} onChange={(e) => setFaixa(e.target.value)}>
            <option value="">Todas</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
        <button className="btn" type="submit">Filtrar</button>
      </form>

      <div className="card">
        {carregando ? (
          <p>Carregando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Código ERP</th>
                <th>Cliente</th>
                <th>Score</th>
                <th>Prioridade</th>
                <th>Títulos abertos</th>
                <th>Valor em aberto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td>{c.codigo_erp_cliente}</td>
                  <td>{c.nome}</td>
                  <td>{c.score_atual}</td>
                  <td><span className={`badge ${c.faixa_prioridade}`}>{c.faixa_prioridade}</span></td>
                  <td>{c.qtd_titulos_aberto}</td>
                  <td>{formatarMoeda(c.valor_em_aberto)}</td>
                  <td><Link to={`/clientes/${c.id}`}>Ver ficha</Link></td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr><td colSpan={7}>Nenhum cliente encontrado.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
