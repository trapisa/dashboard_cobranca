const ExcelJS = require('exceljs');
const db = require('../config/db');
const scoreService = require('./scoreService');
const juridicoAutoService = require('./juridicoAutoService');

const COLUNAS_OBRIGATORIAS = [
  'Empresa',
  'Obra',
  'Venda',
  'Parcela',
  'Vencim.',
  'Valor Parc.',
  'Cód. cliente principal',
  'Cliente principal',
  'Status',
  'Cobrança Parc.',
];

function parseData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  // tenta formatos comuns dd/mm/yyyy
  const str = String(valor).trim();
  const partes = str.split(/[\/\-]/);
  if (partes.length === 3) {
    const [d, m, y] = partes;
    const ano = y.length === 2 ? `20${y}` : y;
    const data = new Date(Number(ano), Number(m) - 1, Number(d));
    if (!isNaN(data.getTime())) return data;
  }
  const generica = new Date(str);
  return isNaN(generica.getTime()) ? null : generica;
}

function parseValor(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return valor;
  const limpo = String(valor)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? null : num;
}

async function lerPlanilha(caminhoArquivo) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(caminhoArquivo);
  const sheet = workbook.worksheets[0];

  const headerRow = sheet.getRow(1);
  const colunaIndice = {};
  headerRow.eachCell((cell, colNumber) => {
    const texto = String(cell.value || '').trim();
    if (texto) colunaIndice[texto] = colNumber;
  });

  const faltantes = COLUNAS_OBRIGATORIAS.filter((c) => !colunaIndice[c]);
  if (faltantes.length > 0) {
    throw new Error(`Colunas obrigatórias ausentes na planilha: ${faltantes.join(', ')}`);
  }

  const linhas = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // cabeçalho
    const get = (nomeColuna) => {
      const idx = colunaIndice[nomeColuna];
      const cell = row.getCell(idx);
      return cell ? cell.value : null;
    };

    linhas.push({
      linha: rowNumber,
      empresa: get('Empresa'),
      obra: get('Obra'),
      venda: get('Venda'),
      parcela: get('Parcela'),
      vencimento: get('Vencim.'),
      valorParc: get('Valor Parc.'),
      codClientePrincipal: get('Cód. cliente principal'),
      clientePrincipal: get('Cliente principal'),
      status: get('Status'),
      cobrancaParc: get('Cobrança Parc.'),
    });
  });

  return linhas;
}

async function resolverEmpreendimento(client, cache, codigoErp, nome) {
  if (cache.empreendimentos.has(codigoErp)) return cache.empreendimentos.get(codigoErp);
  const existente = await client.query('SELECT id FROM empreendimentos WHERE codigo_erp = $1', [codigoErp]);
  if (existente.rows.length > 0) {
    cache.empreendimentos.set(codigoErp, existente.rows[0].id);
    return existente.rows[0].id;
  }
  const inserido = await client.query(
    'INSERT INTO empreendimentos (codigo_erp, nome) VALUES ($1, $2) RETURNING id',
    [codigoErp, nome || codigoErp]
  );
  cache.empreendimentos.set(codigoErp, inserido.rows[0].id);
  return inserido.rows[0].id;
}

async function resolverCliente(client, cache, codigoErpCliente, nome) {
  if (cache.clientes.has(codigoErpCliente)) {
    const id = cache.clientes.get(codigoErpCliente);
    // evita UPDATE repetido pro mesmo cliente várias vezes na mesma importação
    if (!cache.clientesAtualizados.has(codigoErpCliente)) {
      await client.query('UPDATE clientes SET nome = $1, atualizado_em = now() WHERE id = $2', [nome, id]);
      cache.clientesAtualizados.add(codigoErpCliente);
    }
    return id;
  }
  const existente = await client.query('SELECT id FROM clientes WHERE codigo_erp_cliente = $1', [codigoErpCliente]);
  if (existente.rows.length > 0) {
    await client.query('UPDATE clientes SET nome = $1, atualizado_em = now() WHERE id = $2', [
      nome || existente.rows[0].nome,
      existente.rows[0].id,
    ]);
    cache.clientes.set(codigoErpCliente, existente.rows[0].id);
    cache.clientesAtualizados.add(codigoErpCliente);
    return existente.rows[0].id;
  }
  const inserido = await client.query(
    'INSERT INTO clientes (codigo_erp_cliente, nome) VALUES ($1, $2) RETURNING id',
    [codigoErpCliente, nome || codigoErpCliente]
  );
  cache.clientes.set(codigoErpCliente, inserido.rows[0].id);
  cache.clientesAtualizados.add(codigoErpCliente);
  return inserido.rows[0].id;
}

async function resolverContrato(client, cache, empreendimentoId, clienteId, numeroVenda) {
  const chave = `${empreendimentoId}|${clienteId}|${numeroVenda}`;
  if (cache.contratos.has(chave)) return cache.contratos.get(chave);
  const existente = await client.query(
    'SELECT id FROM contratos WHERE empreendimento_id = $1 AND cliente_id = $2 AND numero_venda = $3',
    [empreendimentoId, clienteId, numeroVenda]
  );
  if (existente.rows.length > 0) {
    cache.contratos.set(chave, existente.rows[0].id);
    return existente.rows[0].id;
  }
  const inserido = await client.query(
    'INSERT INTO contratos (empreendimento_id, cliente_id, numero_venda) VALUES ($1, $2, $3) RETURNING id',
    [empreendimentoId, clienteId, numeroVenda]
  );
  cache.contratos.set(chave, inserido.rows[0].id);
  return inserido.rows[0].id;
}

async function resolverFundo(client, cache, codigoErpFundo) {
  if (!codigoErpFundo) return null;
  const chave = String(codigoErpFundo).trim();
  if (cache.fundos.has(chave)) return cache.fundos.get(chave);
  const existente = await client.query('SELECT id FROM fundos WHERE codigo_erp = $1', [chave]);
  const id = existente.rows.length > 0 ? existente.rows[0].id : null;
  cache.fundos.set(chave, id);
  return id;
}

async function processarImportacao({ importacaoId, caminhoArquivo, usuarioId }) {
  let linhas;
  try {
    linhas = await lerPlanilha(caminhoArquivo);
  } catch (err) {
    console.error(`[importacao ${importacaoId}] Falha ao ler a planilha:`, err.message);
    await db.query(
      `UPDATE importacoes SET status = 'erro', mensagem_erro = $1, finalizado_em = now() WHERE id = $2`,
      [err.message, importacaoId]
    );
    throw err;
  }

  console.log(`[importacao ${importacaoId}] Planilha lida: ${linhas.length} linhas. Iniciando processamento...`);

  let qtdNovos = 0;
  let qtdAtualizados = 0;
  let qtdErros = 0;
  let qtdFundosNaoMapeados = 0;
  const erros = [];
  const titulosVistosIds = new Set();
  const cache = {
    empreendimentos: new Map(),
    clientes: new Map(),
    clientesAtualizados: new Set(),
    contratos: new Map(),
    fundos: new Map(),
  };

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    let processadas = 0;
    for (const linha of linhas) {
      processadas++;
      if (processadas % 200 === 0) {
        console.log(`[importacao ${importacaoId}] ${processadas}/${linhas.length} linhas processadas...`);
      }
      try {
        const empresa = linha.empresa != null ? String(linha.empresa).trim() : '';
        const venda = linha.venda != null ? String(linha.venda).trim() : '';
        const parcela = linha.parcela != null ? String(linha.parcela).trim() : '';
        const codCliente = linha.codClientePrincipal != null ? String(linha.codClientePrincipal).trim() : '';
        const nomeCliente = linha.clientePrincipal != null ? String(linha.clientePrincipal).trim() : '';
        const vencimento = parseData(linha.vencimento);
        const valorParc = parseValor(linha.valorParc);

        if (!empresa || !venda || !parcela || !codCliente || !nomeCliente || !vencimento || valorParc === null) {
          qtdErros++;
          erros.push({ linha: linha.linha, motivo: 'Coluna obrigatória vazia ou inválida.' });
          continue;
        }

        const empreendimentoId = await resolverEmpreendimento(client, cache, empresa, linha.obra);
        const clienteId = await resolverCliente(client, cache, codCliente, nomeCliente);
        const contratoId = await resolverContrato(client, cache, empreendimentoId, clienteId, venda);
        const fundoId = await resolverFundo(client, cache, linha.cobrancaParc);

        if (linha.cobrancaParc && !fundoId) {
          qtdFundosNaoMapeados++;
        }

        const tituloExistente = await client.query(
          'SELECT id, valor_original, status, fundo_id FROM titulos WHERE contrato_id = $1 AND numero_parcela = $2 AND vencimento = $3',
          [contratoId, parcela, vencimento]
        );

        if (tituloExistente.rows.length === 0) {
          const inserido = await client.query(
            `INSERT INTO titulos (contrato_id, numero_parcela, vencimento, valor_original, valor_atualizado, status, fundo_id, ultima_importacao_id)
             VALUES ($1, $2, $3, $4, $4, 'aberto', $5, $6) RETURNING id`,
            [contratoId, parcela, vencimento, valorParc, fundoId, importacaoId]
          );
          titulosVistosIds.add(inserido.rows[0].id);
          qtdNovos++;

          await client.query(
            `INSERT INTO timeline_eventos (cliente_id, titulo_id, tipo, descricao)
             VALUES ($1, $2, 'movimentacao', $3)`,
            [clienteId, inserido.rows[0].id, `Novo título importado: parcela ${parcela}, venc. ${vencimento.toISOString().slice(0, 10)}, valor R$ ${valorParc.toFixed(2)}`]
          );
        } else {
          const tit = tituloExistente.rows[0];
          titulosVistosIds.add(tit.id);
          const mudouValor = Number(tit.valor_original) !== valorParc;
          const mudouFundo = (tit.fundo_id || null) !== (fundoId || null);

          if (mudouValor || mudouFundo) {
            await client.query(
              `UPDATE titulos SET valor_original = $1, valor_atualizado = $1, fundo_id = $2, ultima_importacao_id = $3, atualizado_em = now()
               WHERE id = $4`,
              [valorParc, fundoId, importacaoId, tit.id]
            );
            await client.query(
              `INSERT INTO timeline_eventos (cliente_id, titulo_id, tipo, descricao)
               VALUES ($1, $2, 'movimentacao', $3)`,
              [clienteId, tit.id, `Título atualizado na importação (valor e/ou fundo alterados).`]
            );
            qtdAtualizados++;
          } else {
            await client.query('UPDATE titulos SET ultima_importacao_id = $1 WHERE id = $2', [importacaoId, tit.id]);
          }
        }
      } catch (errLinha) {
        qtdErros++;
        erros.push({ linha: linha.linha, motivo: errLinha.message });
      }
    }

    // Baixa automática: títulos que estavam 'aberto' e não vieram nesta importação
    const baixados = await client.query(
      `UPDATE titulos
       SET status = 'baixado', atualizado_em = now()
       WHERE status = 'aberto' AND (ultima_importacao_id IS DISTINCT FROM $1 OR ultima_importacao_id IS NULL)
       RETURNING id, contrato_id`,
      [importacaoId]
    );

    for (const t of baixados.rows) {
      const contratoInfo = await client.query('SELECT cliente_id FROM contratos WHERE id = $1', [t.contrato_id]);
      const clienteId = contratoInfo.rows[0]?.cliente_id;
      if (clienteId) {
        await client.query(
          `INSERT INTO timeline_eventos (cliente_id, titulo_id, tipo, descricao)
           VALUES ($1, $2, 'movimentacao', 'Título baixado automaticamente (não presente na importação mais recente).')`,
          [clienteId, t.id]
        );
      }
    }

    await client.query(
      `UPDATE importacoes SET status = 'concluido', qtd_novos = $1, qtd_atualizados = $2, qtd_baixados = $3,
       qtd_erros = $4, qtd_fundos_nao_mapeados = $5, erros_detalhe = $6, finalizado_em = now()
       WHERE id = $7`,
      [qtdNovos, qtdAtualizados, baixados.rows.length, qtdErros, qtdFundosNaoMapeados, JSON.stringify(erros), importacaoId]
    );

    await client.query('COMMIT');
    console.log(
      `[importacao ${importacaoId}] Concluída: ${qtdNovos} novos, ${qtdAtualizados} atualizados, ${baixados.rows.length} baixados, ${qtdErros} erros.`
    );
  } catch (err) {
    console.error(`[importacao ${importacaoId}] Erro durante o processamento:`, err.message);
    await client.query('ROLLBACK');
    await db.query(
      `UPDATE importacoes SET status = 'erro', mensagem_erro = $1, finalizado_em = now() WHERE id = $2`,
      [err.message, importacaoId]
    );
    throw err;
  } finally {
    client.release();
  }

  // Encaminha automaticamente ao jurídico quem atingiu o limite de dias de atraso da régua
  // (roda antes do recálculo de score, pra já refletir "ja_em_juridico" corretamente)
  await juridicoAutoService.transferirAutomaticamenteParaJuridico();

  // Recalcula score de todos os clientes após a importação
  await scoreService.recalcularTodos();
}

module.exports = { processarImportacao, lerPlanilha, COLUNAS_OBRIGATORIAS };