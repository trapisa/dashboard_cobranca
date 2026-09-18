import { useEffect, useState } from 'react';
import api from '../services/api';

function formatarDataHora(data) {
  return new Date(data).toLocaleString('pt-BR');
}

export default function Importacao() {
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [importacoes, setImportacoes] = useState([]);

  function carregar() {
    api.get('/importacoes').then(({ data }) => setImportacoes(data.importacoes));
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 5000);
    return () => clearInterval(intervalo);
  }, []);

  async function enviar(e) {
    e.preventDefault();
    if (!arquivo) return;
    setEnviando(true);
    setErro('');
    setMensagem('');
    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);
      await api.post('/importacoes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMensagem('Planilha enviada. O processamento roda em segundo plano — atualize a lista abaixo em alguns segundos.');
      setArquivo(null);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao enviar planilha.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div className="topo-pagina">
        <h2>Importação de Planilha</h2>
      </div>

      <form className="card" onSubmit={enviar} style={{ marginBottom: 24 }}>
        <p style={{ marginTop: 0, color: '#64748b', fontSize: 13 }}>
          Envie a exportação diária do ERP UAU/Senior (.xlsx). Colunas obrigatórias: Empresa, Obra, Venda, Parcela,
          Vencim., Valor Parc., Cód. cliente principal, Cliente principal, Status, Cobrança Parc.
        </p>
        <input type="file" accept=".xlsx,.xls" onChange={(e) => setArquivo(e.target.files[0])} />
        {erro && <div className="erro-msg">{erro}</div>}
        {mensagem && <div style={{ color: '#16a34a', fontSize: 13, marginTop: 8 }}>{mensagem}</div>}
        <div style={{ marginTop: 12 }}>
          <button className="btn" type="submit" disabled={!arquivo || enviando}>
            {enviando ? 'Enviando...' : 'Enviar planilha'}
          </button>
        </div>
      </form>

      <div className="card">
        <h3>Histórico de importações</h3>
        <table>
          <thead>
            <tr>
              <th>Arquivo</th><th>Data</th><th>Status</th><th>Novos</th><th>Atualizados</th>
              <th>Baixados</th><th>Erros</th><th>Fundos não mapeados</th>
            </tr>
          </thead>
          <tbody>
            {importacoes.map((imp) => (
              <tr key={imp.id}>
                <td>{imp.arquivo_nome}</td>
                <td>{formatarDataHora(imp.data_upload)}</td>
                <td>{imp.status}</td>
                <td>{imp.qtd_novos}</td>
                <td>{imp.qtd_atualizados}</td>
                <td>{imp.qtd_baixados}</td>
                <td>{imp.qtd_erros}</td>
                <td>{imp.qtd_fundos_nao_mapeados}</td>
              </tr>
            ))}
            {importacoes.length === 0 && <tr><td colSpan={8}>Nenhuma importação realizada ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
