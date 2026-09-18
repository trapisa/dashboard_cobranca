import { useEffect, useState } from 'react';
import api from '../services/api';

const CANAIS = ['email', 'sms', 'whatsapp'];

export default function ConfigRegua() {
  const [etapas, setEtapas] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [novaEtapa, setNovaEtapa] = useState({ diasAtraso: '', canal: 'email', templateId: '' });
  const [novoTemplate, setNovoTemplate] = useState({ nome: '', canal: 'email', assunto: '', corpo: '' });

  function carregar() {
    api.get('/regua/etapas').then(({ data }) => setEtapas(data.etapas));
    api.get('/regua/templates').then(({ data }) => setTemplates(data.templates));
  }

  useEffect(() => { carregar(); }, []);

  async function criarEtapa(e) {
    e.preventDefault();
    await api.post('/regua/etapas', {
      diasAtraso: Number(novaEtapa.diasAtraso),
      canal: novaEtapa.canal,
      templateId: novaEtapa.templateId || null,
    });
    setNovaEtapa({ diasAtraso: '', canal: 'email', templateId: '' });
    carregar();
  }

  async function removerEtapa(id) {
    await api.delete(`/regua/etapas/${id}`);
    carregar();
  }

  async function criarTemplate(e) {
    e.preventDefault();
    await api.post('/regua/templates', novoTemplate);
    setNovoTemplate({ nome: '', canal: 'email', assunto: '', corpo: '' });
    carregar();
  }

  return (
    <div>
      <div className="topo-pagina"><h2>Régua de Cobrança</h2></div>

      <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <h3>Etapas configuradas</h3>
          <table>
            <thead><tr><th>Dias de atraso</th><th>Canal</th><th>Template</th><th></th></tr></thead>
            <tbody>
              {etapas.map((et) => (
                <tr key={et.id}>
                  <td>{et.dias_atraso}</td>
                  <td>{et.canal}</td>
                  <td>{et.template_nome || '-'}</td>
                  <td><button className="btn secundario" onClick={() => removerEtapa(et.id)}>Remover</button></td>
                </tr>
              ))}
              {etapas.length === 0 && <tr><td colSpan={4}>Nenhuma etapa cadastrada.</td></tr>}
            </tbody>
          </table>

          <form onSubmit={criarEtapa} style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <div className="form-linha">
              <label>Dias de atraso (a partir de)</label>
              <input type="number" value={novaEtapa.diasAtraso}
                onChange={(e) => setNovaEtapa({ ...novaEtapa, diasAtraso: e.target.value })} required />
            </div>
            <div className="form-linha">
              <label>Canal</label>
              <select value={novaEtapa.canal} onChange={(e) => setNovaEtapa({ ...novaEtapa, canal: e.target.value })}>
                {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-linha">
              <label>Template</label>
              <select value={novaEtapa.templateId} onChange={(e) => setNovaEtapa({ ...novaEtapa, templateId: e.target.value })}>
                <option value="">Nenhum</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <button className="btn" type="submit">Adicionar etapa</button>
          </form>
        </div>

        <div className="card">
          <h3>Templates de mensagem</h3>
          <table>
            <thead><tr><th>Nome</th><th>Canal</th></tr></thead>
            <tbody>
              {templates.map((t) => <tr key={t.id}><td>{t.nome}</td><td>{t.canal}</td></tr>)}
              {templates.length === 0 && <tr><td colSpan={2}>Nenhum template cadastrado.</td></tr>}
            </tbody>
          </table>

          <form onSubmit={criarTemplate} style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <div className="form-linha">
              <label>Nome do template</label>
              <input type="text" value={novoTemplate.nome}
                onChange={(e) => setNovoTemplate({ ...novoTemplate, nome: e.target.value })} required />
            </div>
            <div className="form-linha">
              <label>Canal</label>
              <select value={novoTemplate.canal} onChange={(e) => setNovoTemplate({ ...novoTemplate, canal: e.target.value })}>
                {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {novoTemplate.canal === 'email' && (
              <div className="form-linha">
                <label>Assunto</label>
                <input type="text" value={novoTemplate.assunto}
                  onChange={(e) => setNovoTemplate({ ...novoTemplate, assunto: e.target.value })} />
              </div>
            )}
            <div className="form-linha">
              <label>Corpo (use variáveis como {'{{nome_cliente}}'}, {'{{valor_devido}}'}, {'{{vencimento}}'})</label>
              <textarea rows={4} value={novoTemplate.corpo}
                onChange={(e) => setNovoTemplate({ ...novoTemplate, corpo: e.target.value })} required />
            </div>
            <button className="btn" type="submit">Salvar template</button>
          </form>
        </div>
      </div>
    </div>
  );
}
