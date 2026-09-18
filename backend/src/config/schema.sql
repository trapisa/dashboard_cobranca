-- ============================================================
-- CRM de Cobrança de Inadimplentes — Grupo Trapisa
-- Schema PostgreSQL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- usuarios ----------
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil VARCHAR(20) NOT NULL CHECK (perfil IN ('admin', 'cobranca', 'juridico', 'diretoria')),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- empreendimentos ----------
CREATE TABLE IF NOT EXISTS empreendimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_erp VARCHAR(50) NOT NULL UNIQUE, -- coluna "Empresa" da planilha
    nome VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- fundos ----------
CREATE TABLE IF NOT EXISTS fundos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_erp VARCHAR(50) NOT NULL UNIQUE, -- coluna "Cobrança Parc."
    nome VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO fundos (codigo_erp, nome) VALUES
    ('-1-', 'Credcamp'),
    ('-6-', 'GFM'),
    ('-10-', 'LBA')
ON CONFLICT (codigo_erp) DO NOTHING;

-- ---------- clientes ----------
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_erp_cliente VARCHAR(50) NOT NULL UNIQUE, -- "Cód. cliente principal"
    nome VARCHAR(255) NOT NULL,
    score_atual INT NOT NULL DEFAULT 0,
    faixa_prioridade VARCHAR(20) NOT NULL DEFAULT 'baixa' CHECK (faixa_prioridade IN ('baixa', 'media', 'alta')),
    score_atualizado_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- contratos ----------
CREATE TABLE IF NOT EXISTS contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empreendimento_id UUID NOT NULL REFERENCES empreendimentos(id),
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    numero_venda VARCHAR(50) NOT NULL, -- "Venda"
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empreendimento_id, cliente_id, numero_venda)
);

CREATE INDEX IF NOT EXISTS idx_contratos_cliente ON contratos(cliente_id);

-- ---------- titulos ----------
CREATE TABLE IF NOT EXISTS titulos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id UUID NOT NULL REFERENCES contratos(id),
    numero_parcela VARCHAR(20) NOT NULL, -- "Parcela"
    vencimento DATE NOT NULL, -- "Vencim."
    valor_original NUMERIC(14,2) NOT NULL, -- "Valor Parc."
    valor_atualizado NUMERIC(14,2),
    status VARCHAR(20) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'pago', 'cedido', 'em_juridico', 'baixado')),
    fundo_id UUID REFERENCES fundos(id),
    ultima_importacao_id UUID, -- referência à importação que confirmou este título por último
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (contrato_id, numero_parcela, vencimento)
);

CREATE INDEX IF NOT EXISTS idx_titulos_contrato ON titulos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_titulos_status ON titulos(status);
CREATE INDEX IF NOT EXISTS idx_titulos_vencimento ON titulos(vencimento);
CREATE INDEX IF NOT EXISTS idx_titulos_fundo ON titulos(fundo_id);

-- ---------- importacoes ----------
CREATE TABLE IF NOT EXISTS importacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arquivo_nome VARCHAR(255) NOT NULL,
    data_upload TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    qtd_novos INT NOT NULL DEFAULT 0,
    qtd_atualizados INT NOT NULL DEFAULT 0,
    qtd_baixados INT NOT NULL DEFAULT 0,
    qtd_erros INT NOT NULL DEFAULT 0,
    qtd_fundos_nao_mapeados INT NOT NULL DEFAULT 0,
    erros_detalhe JSONB DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'processando' CHECK (status IN ('processando', 'concluido', 'erro')),
    mensagem_erro TEXT,
    finalizado_em TIMESTAMPTZ
);

-- ---------- timeline_eventos ----------
CREATE TABLE IF NOT EXISTS timeline_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    titulo_id UUID REFERENCES titulos(id),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('contato', 'negociacao', 'movimentacao', 'encaminhamento', 'judicial')),
    descricao TEXT NOT NULL,
    autor_id UUID REFERENCES usuarios(id),
    data TIMESTAMPTZ NOT NULL DEFAULT now(),
    anexo_url VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_timeline_cliente ON timeline_eventos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_timeline_data ON timeline_eventos(data DESC);

-- ---------- casos_juridicos ----------
CREATE TABLE IF NOT EXISTS casos_juridicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    status VARCHAR(20) NOT NULL DEFAULT 'encaminhado' CHECK (status IN ('encaminhado', 'protocolado', 'em_andamento', 'sentenca', 'execucao', 'acordo')),
    numero_processo VARCHAR(100),
    data_encaminhamento TIMESTAMPTZ NOT NULL DEFAULT now(),
    observacoes TEXT,
    criado_por UUID REFERENCES usuarios(id),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_casos_cliente ON casos_juridicos(cliente_id);

-- tabela pivô caso <-> títulos
CREATE TABLE IF NOT EXISTS casos_juridicos_titulos (
    caso_id UUID NOT NULL REFERENCES casos_juridicos(id) ON DELETE CASCADE,
    titulo_id UUID NOT NULL REFERENCES titulos(id),
    PRIMARY KEY (caso_id, titulo_id)
);

-- ---------- regua_etapas ----------
CREATE TABLE IF NOT EXISTS regua_etapas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dias_atraso INT NOT NULL,
    canal VARCHAR(20) NOT NULL CHECK (canal IN ('email', 'sms', 'whatsapp')),
    template_id UUID,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- templates_mensagem ----------
CREATE TABLE IF NOT EXISTS templates_mensagem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(200) NOT NULL,
    canal VARCHAR(20) NOT NULL CHECK (canal IN ('email', 'sms', 'whatsapp')),
    assunto VARCHAR(255),
    corpo TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE regua_etapas
    ADD CONSTRAINT fk_regua_template FOREIGN KEY (template_id) REFERENCES templates_mensagem(id);

-- ---------- score_regras ----------
CREATE TABLE IF NOT EXISTS score_regras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    descricao VARCHAR(255) NOT NULL,
    condicao JSONB NOT NULL, -- ex: {"campo": "dias_atraso", "operador": ">", "valor": 90}
    pontos INT NOT NULL,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO score_regras (descricao, condicao, pontos) VALUES
    ('Atraso superior a 90 dias', '{"campo": "dias_atraso", "operador": ">", "valor": 90}', 30),
    ('Valor total em aberto superior a R$ 10.000', '{"campo": "valor_total_em_aberto", "operador": ">", "valor": 10000}', 20),
    ('Possui negociação quebrada', '{"campo": "possui_negociacao_quebrada", "operador": "=", "valor": true}', 25),
    ('Já está em jurídico', '{"campo": "ja_em_juridico", "operador": "=", "valor": true}', 40)
ON CONFLICT DO NOTHING;

-- ---------- auditoria ----------
CREATE TABLE IF NOT EXISTS auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id),
    acao VARCHAR(100) NOT NULL,
    entidade VARCHAR(100),
    entidade_id UUID,
    detalhe JSONB,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_data ON auditoria(criado_em DESC);
