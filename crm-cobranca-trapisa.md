# Documentação Técnica — CRM de Cobrança de Inadimplentes (Grupo Trapisa)

## 1. Visão Geral

Sistema web para gestão da carteira inadimplente do grupo, alimentado por upload diário de planilha (exportação do ERP UAU/Senior, ~2.500 linhas), com dashboard executivo, ficha de cliente/título, régua de cobrança configurável (disparo manual), score de priorização por regras, encaminhamento ao jurídico e histórico completo (CRM).

## 2. Stack Técnica (100% gratuita)

- **Backend:** Node.js + Express
- **Banco de dados:** PostgreSQL
- **Frontend:** React
- **Autenticação:** JWT + bcrypt
- **Parser de planilha:** `exceljs` ou `xlsx`
- **Processamento de upload:** job assíncrono (`bullmq` + Redis, ou tabela de jobs própria)
- **Hospedagem:** VPS próprio (único custo real é infraestrutura, não licenças)

## 3. Autenticação e Perfis

Login usuário/senha (hash bcrypt), sessão JWT.

| Perfil | Permissões |
|---|---|
| **Admin** | Upload de planilha, configuração de régua, score e fundos |
| **Cobrança** | Timeline, negociações, encaminhamentos |
| **Jurídico** | Vê e atualiza apenas os casos encaminhados a ele |
| **Diretoria/Consulta** | Somente leitura (dashboard e fichas) |

## 4. Modelo de Dados

### `empreendimentos`
- `id`, `codigo_erp` (= coluna `Empresa` da planilha), `nome`

### `clientes`
- `id`, `codigo_erp_cliente` (= `Cód. cliente principal`), `nome`

### `contratos`
- `id`, `empreendimento_id`, `cliente_id`, `numero_venda` (= `Venda`)
- Chave única: `empreendimento_id + cliente_id + numero_venda`

### `titulos`
- `id`, `contrato_id`, `numero_parcela` (= `Parcela`), `vencimento` (= `Vencim.`), `valor_original` (= `Valor Parc.`), `valor_atualizado`, `status` (`aberto`, `pago`, `cedido`, `em_juridico`, `baixado`), `fundo_id` (nullable)
- Chave única (usada no diff de importação): `contrato_id + numero_parcela + vencimento`

### `fundos`
- `id`, `codigo_erp` (coluna `Cobrança Parc.`), `nome`
- Seed inicial:

| codigo_erp | nome |
|---|---|
| -1- | Credcamp |
| -6- | GFM |
| -10- | LBA |

### `importacoes`
- `id`, `arquivo_nome`, `data_upload`, `usuario_id`, `qtd_novos`, `qtd_atualizados`, `qtd_baixados`, `qtd_erros`, `qtd_fundos_nao_mapeados`, `status` (`processando`, `concluido`, `erro`)

### `timeline_eventos`
- `id`, `cliente_id`, `titulo_id` (nullable — pode ser evento geral do cliente), `tipo` (`contato`, `negociacao`, `movimentacao`, `encaminhamento`, `judicial`), `descricao`, `autor_id`, `data`, `anexo_url` (nullable)

### `casos_juridicos`
- `id`, `cliente_id`, `titulo_ids` (array ou tabela pivô), `status` (preenchimento manual: `encaminhado`, `protocolado`, `em_andamento`, `sentenca`, `execucao`, `acordo`), `numero_processo` (manual), `data_encaminhamento`, `observacoes`

### `regua_etapas`
- `id`, `dias_atraso`, `canal` (`email`, `sms`, `whatsapp`), `template_id`, `ativa`

### `templates_mensagem`
- `id`, `nome`, `canal`, `assunto` (se e-mail), `corpo`

### `score_regras`
- `id`, `descricao`, `condicao` (estrutura JSON, ex.: `{"campo": "dias_atraso", "operador": ">", "valor": 90}`), `pontos`, `ativa`

### `usuarios`
- `id`, `nome`, `email`, `senha_hash`, `perfil`

## 5. Colunas Obrigatórias na Planilha (validação de upload)

`Empresa`, `Obra`, `Venda`, `Parcela`, `Vencim.`, `Valor Parc.`, `Cód. cliente principal`, `Cliente principal`, `Status`, `Cobrança Parc.`

Linhas com qualquer uma dessas colunas vazia/inválida são rejeitadas e listadas no relatório de erros da importação, sem travar o restante do processamento.

## 6. Fluxo de Importação

1. Admin faz upload do XLSX.
2. Sistema valida colunas obrigatórias.
3. Job assíncrono processa linha a linha:
   - Resolve/cria `empreendimento` (por `codigo_erp` = `Empresa`).
   - Resolve/cria `cliente` (por `codigo_erp_cliente`).
   - Resolve/cria `contrato` (chave: empreendimento + cliente + venda).
   - Para cada título, verifica a chave (`contrato + parcela + vencimento`):
     - **Novo** → insere (`status = aberto`).
     - **Já existe** → não duplica; se valor/status mudou, atualiza e registra `movimentacao` na timeline.
   - Resolve `fundo` via `Cobrança Parc.` → busca em `fundos.codigo_erp`.
     - Se não encontrado, o título fica com `fundo_id = null` e é sinalizado no relatório da importação para cadastro manual posterior.
4. Títulos que estavam abertos na base mas **não vieram** na planilha nova → marcados `status = baixado` (quitação/renegociação fora do fluxo) e registrados na timeline.
5. Tela de resultado da importação exibe: novos, atualizados, baixados, erros de linha, fundos não mapeados.

## 7. Dashboard (Página Inicial)

- Inadimplência total (R$ e quantidade de títulos em aberto).
- Quebra por empreendimento.
- Quebra por fundo.
- Aging da dívida: 0-30 / 30-60 / 60-90 / 90+ dias.
- Evolução mensal (entrada de novos títulos x baixas).
- Contagem por status de encaminhamento (cobrança amigável vs. jurídico).
- Ranking de clientes por score de recuperabilidade.

## 8. Ficha do Cliente

- Dados cadastrais (código ERP, nome).
- Lista de contratos e, dentro de cada um, lista de títulos com: parcela, vencimento, valor original/atualizado, status, fundo.
- Score de recuperabilidade e faixa de prioridade.
- Botão **"Encaminhar ao Jurídico"** → cria `caso_juridico`, muda o status dos títulos selecionados, registra evento na timeline.
- Timeline completa do cliente (eventos mais recentes primeiro).

## 9. Régua de Cobrança e Templates (Configurações)

- Tela de configuração onde o Admin cadastra etapas da régua: `dias_atraso → canal → template`.
- Templates com variáveis (ex.: `{{nome_cliente}}`, `{{valor_devido}}`, `{{vencimento}}`).
- **Disparo manual:** o sistema apenas sinaliza em qual etapa da régua cada cliente se encontra hoje; a equipe de cobrança decide, dispara a mensagem (copiando o template preenchido) e registra o contato na timeline.

## 10. Score de Recuperabilidade (motor de regras)

Tela de configuração de regras: condição (campo + operador + valor) → pontuação.

Regras iniciais:

| Condição | Pontos |
|---|---|
| `dias_atraso > 90` | +30 |
| `valor_total_em_aberto > R$ 10.000` | +20 |
| `possui_negociacao_quebrada = true` | +25 |
| `ja_em_juridico = true` | +40 |

Faixas de classificação:
- `0–30` = Baixa prioridade
- `31–60` = Média prioridade
- `61+` = Alta prioridade

Recalculado a cada importação de planilha (ou sob demanda pela ficha do cliente).

## 11. Módulo Jurídico

- Fila de casos encaminhados.
- Status manual (sem integração com o sistema de sincronização TJSP existente).
- Campos: número de processo, status (`encaminhado`, `protocolado`, `em_andamento`, `sentenca`, `execucao`, `acordo`), data de encaminhamento, observações.
- Toda atualização do caso é registrada na timeline do cliente.

## 12. Auditoria

Toda ação relevante (importação, mudança de status, encaminhamento, edição de regra/template) é registrada com autor e timestamp, seja em tabela específica, seja em `timeline_eventos`.

## 13. LGPD

- Dados de clientes (nome, código ERP, valores de dívida) são dados financeiros sensíveis.
- Controle de acesso por perfil cobre boa parte da exigência de proteção.
- Política de retenção de dados de títulos baixados/quitados ainda a definir com jurídico interno.

## 14. Decisões Registradas (histórico de definição)

- Chave de contrato: `empreendimento + cód. cliente principal + venda` (não há CPF na planilha de origem).
- Chave de título: `contrato + parcela + vencimento`.
- "Empreendimento" = coluna `Empresa` (não `Obra`).
- Fundo identificado pela coluna `Cobrança Parc.`, mapeado por tabela de código → nome.
- Volume atual da planilha: ~2.500 linhas.
- Régua de cobrança: configurada no sistema, mas com disparo manual (não automático).
- Stack: gratuita (Node.js + PostgreSQL + React), sem dependência de licenças pagas.
