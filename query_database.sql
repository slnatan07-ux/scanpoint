REATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    senha VARCHAR(255) NOT NULL,
    qr_code TEXT,
    pontos INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ATIVO',
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE compras (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    data_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valor DECIMAL(10,2),
    loja VARCHAR(100),
    produtos TEXT,
    pontos_gerados INTEGER,
    qr_code_utilizado VARCHAR(255)
);

CREATE TABLE historico_pontos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    data_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acao VARCHAR(100),
    pontos_recebidos INTEGER DEFAULT 0,
    saldo_atual INTEGER
);