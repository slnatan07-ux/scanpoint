const express = require("express");
const app = express();
const cors = require("cors");
const { Pool } = require("pg");
const QRCode = require("qrcode");
const bcrypt = require("bcrypt");

// Força o cadastro.html a ser a página inicial do sistema
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/cadastro.html");
});

app.use(express.static(__dirname));
app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  ssl: process.env.DATABASE_URL ?
{rejectUnauthorized: false } : false
});

pool.query("SELECT NOW()")
    .then(() => console.log("BANCO CONECTADO"))
    .catch(err => console.log("ERRO BANCO:", err.message));

function calcularNivel(pontos) {
    if (pontos >= 500) return "Ouro";
    if (pontos >= 200) return "Prata";
    return "Bronze";
}

// CADASTRO: Agora retorna também o ID gerado para o frontend guardar
app.post("/cadastro", async (req, res) => {
    try {

        const { nome, cpf, telefone, senha } = req.body;

        if (!nome || !cpf || !senha) {
            return res.status(400).json({
                erro: "Preencha todos os campos obrigatórios."
            });
        }

        const cpfExistente = await pool.query(
            "SELECT id FROM usuarios WHERE cpf = $1",
            [cpf]
        );

        if (cpfExistente.rows.length > 0) {
            return res.status(400).json({
                erro: "CPF já cadastrado."
            });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const qrCodeImagem = await QRCode.toDataURL(
            "CLIENTE_" + cpf
        );

        const resultado = await pool.query(
            `INSERT INTO usuarios
            (nome_completo, cpf, telefone, senha, qr_code)
            VALUES ($1,$2,$3,$4,$5)
            RETURNING id`,
            [
                nome,
                cpf,
                telefone,
                senhaHash,
                qrCodeImagem
            ]
        );

res.json({
    id: resultado.rows[0].id
});

    } catch (erro) {

        console.error("ERRO CADASTRO:");
        console.error(erro);

        res.status(500).json({
            erro: erro.message
        });
    }
});


app.post("/login", async (req, res) => {
    try {
        const { cpf, senha } = req.body;
        const usuario = await pool.query("SELECT * FROM usuarios WHERE cpf=$1", [cpf]);

        if (usuario.rows.length === 0) {
            return res.status(401).json({ erro: "Usuário não encontrado" });
        }

        const senhaCorreta = await bcrypt.compare(senha, usuario.rows[0].senha);
        if (!senhaCorreta) {
            return res.status(401).json({ erro: "Senha incorreta" });
        }

        res.json(usuario.rows[0]);
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ erro: "Erro no login" });
    }
});

app.get("/api/usuario/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await pool.query("SELECT pontos FROM usuarios WHERE id = $1", [id]);

        if (usuario.rows.length === 0) {
            return res.status(404).json({ erro: "Usuário não encontrado" });
        }

        const pontos = usuario.rows[0].pontos || 0;
        res.json({ pontos: pontos, nivel: calcularNivel(pontos) });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ erro: "Erro ao carregar dados do usuário" });
    }
});

app.get("/api/ranking", async (req, res) => {
    try {
        const ranking = await pool.query("SELECT nome_completo AS nome, pontos FROM usuarios ORDER BY pontos DESC");
        const listaRanking = ranking.rows.map(u => ({
            nome: u.nome,
            pontos: u.pontos || 0,
            nivel: calcularNivel(u.pontos || 0)
        }));
        res.json(listaRanking);
        
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ erro: "Erro ao carregar ranking" });
    }
});

app.get("/api/historico/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const historico = await pool.query(
            `SELECT acao AS codigo_hash, pontos_recebidos AS valor_pontos 
             FROM historico_pontos WHERE usuario_id = $1 ORDER BY id DESC`,
            [id]
        );
        res.json(historico.rows);
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ erro: "Erro ao carregar histórico" });
    }
});

// NOVA ROTA: Processa o Scan de QR Code vindo do index.html
app.post("/api/scan", async (req, res) => {
    try {
        const { usuarioId, codigo } = req.body;
        const pontosGanhos = 10; // Quantidade de pontos concedida por leitura

        await pool.query("UPDATE usuarios SET pontos = pontos + $1 WHERE id = $2", [pontosGanhos, usuarioId]);
        
        await pool.query(
            `INSERT INTO historico_pontos (usuario_id, acao, pontos_recebidos, saldo_atual)
             VALUES ($1, $2, $3, (SELECT pontos FROM usuarios WHERE id = $1))`,
            [usuarioId, `Scan: ${codigo}`, pontosGanhos]
        );

        res.json({ success: true, mensagem: `Código lido! Ganhou ${pontosGanhos} pontos.` });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ success: false, error: "Erro ao processar validação do QR Code." });
    }
});

// NOVA ROTA: Processa a Troca de Recompensas vinda do index.html
app.post("/api/trocar", async (req, res) => {
    try {
        const { usuarioId, custo } = req.body;

        const usuario = await pool.query("SELECT pontos FROM usuarios WHERE id = $1", [usuarioId]);
        if (usuario.rows.length === 0) {
            return res.json({ success: false, error: "Usuário não encontrado." });
        }

        const pontosAtuais = usuario.rows[0].pontos || 0;
        if (pontosAtuais < custo) {
            return res.json({ success: false, error: "Pontos insuficientes para realizar o resgate." });
        }

        await pool.query("UPDATE usuarios SET pontos = pontos - $1 WHERE id = $2", [custo, usuarioId]);

        await pool.query(
            `INSERT INTO historico_pontos (usuario_id, acao, pontos_recebidos, saldo_atual)
             VALUES ($1, $2, $3, (SELECT pontos FROM usuarios WHERE id = $1))`,
            [usuarioId, `Resgate de Prêmio (-${custo} pts)`, -custo]
        );

        res.json({ success: true });
    } catch (erro) {
        console.log(erro);
        res.status(500).json({ success: false, error: "Erro ao realizar a troca." });
    }
});

app.listen(3000, () => {
    console.log("Servidor rodando em http://localhost:3000"); 
});
