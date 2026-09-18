import { useEffect, useState } from 'react';
import api from '../services/api';

const OPERADORES = ['>', '>=', '<', '<=', '=', '!='];
const CAMPOS = [
  { valor: 'dias_atraso', label: 'Dias de atraso' },
  { valor: 'valor_total_em_aberto', label: 'Valor total em aberto (R$)' },
  { valor: 'possui_negociacao_quebrada', label: 'Possui negociação quebrada (true/false)' },
  { valor: 'ja_em_juridico', label: 'Já está em jurídico (true/false)' },
];

export default function ConfigScore() {
  const [regras, setRegras] = useState([]);
  const [nova, setNova] = useState({ descricao: '', campo: 'dias_atraso', operador: '>', valor: '', pontos: '' });

  function carregar() {
    api.get('/score/regras').then(({ data }) => setRegras(data.regras));
  }

  useEffect(() => { carregar(); }, []);

  async function criar(e) {
    e.preventDefault();
    let valorCondicao = nova.valor;
    if (valorCondicao === 'true') valorCondicao = true;
    else if (valorCondicao === 'false') valorCondicao = false;
    else if (!isNaN(Number(valorCondicao)) && valorCondicao !== '') valorCondicao = Number(valorCondicao);

    await api.post('/score/regras', {
      descricao: nova.descricao,
      condicao: { campo: nova.campo, operador: nova.operador, valor: valorCondicao },
      pontos: Number(nova.pontos),
    });
    setNova({ descricao: '', campo: 'dias_atraso', operador: '>', valor: '', pontos: '' });
    carregar();
  }

  async function alternarAtiva(regra) {
    await api.put(`/score/regras/${regra.id}`, {
      descricao: regra.descricao,
      condicao: regra.condicao,
      pontos: regra.pontos,
      ativa: !regra.ativa,
    });
    carregar();
  }

  async function remover(id) {
    await api.delete(`/score/regras/${id}`);
    carregar();
  }

  return (
    <div>
      <div className="topo-pagina"><h2>Score de Recuperabilidade</h2></div>
      <p style={{ color: '#64748b', maxWidth: 640 }}>
        Faixas de classificação: 0–30 = Baixa prioridade, 31–60 = Média prioridade, 61+ = Alta prioridade.
        O score é recalculado automaticamente a cada importação de planilha.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <table>
          <thead><tr><th>Descrição</th><th>Condição</th><th>Pontos</th><th>Ativa</th><th></th></tr></thead>
          <tbody>
            {regras.map((r) => (
              <tr key={r.id}>
                <td>{r.descricao}</td>
                <td><code>{r.condicao.campo} {r.condicao.operador} {String(r.condicao.valor)}</code></td>
                <td>+{r.pontos}</td>
                <td>
                  <button className="btn secundario" onClick={() => alternarAtiva(r)}>
                    {r.ativa ? 'Ativa' : 'Inativa'}
                  </button>
                </td>
                <td><button className="btn secundario" onClick={() => remover(r.id)}>Remover</button></td>
              </tr>
            ))}
            {regras.length === 0 && <tr><td colSpan={5}>Nenhuma regra cadastrada.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Nova regra</h3>
        <form onSubmit={criar}>
          <div className="form-linha">
            <label>Descrição</label>
            <input type="text" value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} required />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-linha" style={{ flex: 1 }}>
              <label>Campo</label>
              <select value={nova.campo} onChange={(e) => setNova({ ...nova, campo: e.target.value })}>
                {CAMPOS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-linha" style={{ width: 100 }}>
              <label>Operador</label>
              <select value={nova.operador} onChange={(e) => setNova({ ...nova, operador: e.target.value })}>
                {OPERADORES.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
            <div className="form-linha" style={{ width: 140 }}>
              <label>Valor</label>
              <input type="text" value={nova.valor} onChange={(e) => setNova({ ...nova, valor: e.target.value })} required />
            </div>
            <div className="form-linha" style={{ width: 100 }}>
              <label>Pontos</label>
              <input type="number" value={nova.pontos} onChange={(e) => setNova({ ...nova, pontos: e.target.value })} required />
            </div>
          </div>
          <button className="btn" type="submit">Adicionar regra</button>
        </form>
      </div>
    </div>
  );
}
