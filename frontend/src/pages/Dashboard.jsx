import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Dashboard() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get('/dashboard/resumo')
      .then(({ data }) => setDados(data))
      .catch(() => setErro('Erro ao carregar o dashboard.'));
  }, []);

  if (erro) return <div className="card">{erro}</div>;
  if (!dados) return <div>Carregando...</div>;

  return (
    <div>
      <div className="topo-pagina">
        <h2>Dashboard</h2>
      </div>

      <div className="grid-cards">
        <div className="card kpi">
          <div className="rotulo">Inadimplência total (em aberto)</div>
          <div className="valor">{formatarMoeda(dados.inadimplenciaTotal.valor)}</div>
          <div className="rotulo">{dados.inadimplenciaTotal.qtd} título(s)</div>
        </div>
        <div className="card kpi">
          <div className="rotulo">0–30 dias</div>
          <div className="valor">{formatarMoeda(dados.aging.valor_0_30)}</div>
          <div className="rotulo">{dados.aging.faixa_0_30} título(s)</div>
        </div>
        <div className="card kpi">
          <div className="rotulo">30–60 dias</div>
          <div className="valor">{formatarMoeda(dados.aging.valor_30_60)}</div>
          <div className="rotulo">{dados.aging.faixa_30_60} título(s)</div>
        </div>
        <div className="card kpi">
          <div className="rotulo">60–90 dias</div>
          <div className="valor">{formatarMoeda(dados.aging.valor_60_90)}</div>
          <div className="rotulo">{dados.aging.faixa_60_90} título(s)</div>
        </div>
        <div className="card kpi">
          <div className="rotulo">90+ dias</div>
          <div className="valor">{formatarMoeda(dados.aging.valor_90_mais)}</div>
          <div className="rotulo">{dados.aging.faixa_90_mais} título(s)</div>
        </div>
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <h3>Por empreendimento</h3>
          <table>
            <thead>
              <tr><th>Empreendimento</th><th>Títulos</th><th>Valor</th></tr>
            </thead>
            <tbody>
              {dados.porEmpreendimento.map((e) => (
                <tr key={e.nome}>
                  <td>{e.nome}</td>
                  <td>{e.qtd}</td>
                  <td>{formatarMoeda(e.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Por fundo</h3>
          <table>
            <thead>
              <tr><th>Fundo</th><th>Títulos</th><th>Valor</th></tr>
            </thead>
            <tbody>
              {dados.porFundo.map((f) => (
                <tr key={f.nome}>
                  <td>{f.nome}</td>
                  <td>{f.qtd}</td>
                  <td>{formatarMoeda(f.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Encaminhamento</h3>
        <p>
          Cobrança amigável: <strong>{dados.porEncaminhamento.cobranca_amigavel}</strong> título(s) &nbsp;|&nbsp;
          Jurídico: <strong>{dados.porEncaminhamento.juridico}</strong> título(s)
        </p>
      </div>

      <div className="card">
        <h3>Ranking de clientes por score de recuperabilidade</h3>
        <table>
          <thead>
            <tr><th>Cliente</th><th>Score</th><th>Prioridade</th><th>Valor em aberto</th><th></th></tr>
          </thead>
          <tbody>
            {dados.rankingClientes.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td>{c.score_atual}</td>
                <td><span className={`badge ${c.faixa_prioridade}`}>{c.faixa_prioridade}</span></td>
                <td>{formatarMoeda(c.valor_em_aberto)}</td>
                <td><Link to={`/clientes/${c.id}`}>Ver ficha</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
