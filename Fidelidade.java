import java.sql.*;
import java.util.UUID;

public class Fidelidade {

    private static final String URL = "jdbc:postgresql://localhost:5432/fidelidade";
    private static final String USER = "postgres";
    private static final String PASSWORD = "123456";

    public static Connection conectar() throws Exception {
        Class.forName("org.postgresql.Driver");
        return DriverManager.getConnection(URL, USER, PASSWORD);
    }

    public static void cadastrarUsuario(
            String nome,
            String cpf,
            String telefone,
            String email,
            String senha) {

        try {

            Connection con = conectar();

            String sql =
                "INSERT INTO usuarios " +
                "(nome_completo, cpf, telefone, email, senha, qr_code) " +
                "VALUES (?, ?, ?, ?, ?, ?)";

            PreparedStatement stmt = con.prepareStatement(sql);

            stmt.setString(1, nome);
            stmt.setString(2, cpf);
            stmt.setString(3, telefone);
            stmt.setString(4, email);
            stmt.setString(5, senha);
            stmt.setString(6, UUID.randomUUID().toString());

            stmt.executeUpdate();

            System.out.println("Usuário cadastrado!");

            stmt.close();
            con.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static boolean login(String email, String senha) {

        try {

            Connection con = conectar();

            String sql =
                "SELECT * FROM usuarios WHERE email=? AND senha=?";

            PreparedStatement stmt = con.prepareStatement(sql);

            stmt.setString(1, email);
            stmt.setString(2, senha);

            ResultSet rs = stmt.executeQuery();

            boolean encontrou = rs.next();

            rs.close();
            stmt.close();
            con.close();

            return encontrou;

        } catch (Exception e) {
            e.printStackTrace();
        }

        return false;
    }

    public static void registrarCompra(
            int usuarioId,
            double valor,
            String loja,
            String produtos,
            String qrCode) {

        try {

            Connection con = conectar();

            int pontos = (int) valor;

            String compraSql =
                "INSERT INTO compras " +
                "(usuario_id, valor, loja, produtos, pontos_gerados, qr_code_utilizado) " +
                "VALUES (?, ?, ?, ?, ?, ?)";

            PreparedStatement compra = con.prepareStatement(compraSql);

            compra.setInt(1, usuarioId);
            compra.setDouble(2, valor);
            compra.setString(3, loja);
            compra.setString(4, produtos);
            compra.setInt(5, pontos);
            compra.setString(6, qrCode);

            compra.executeUpdate();

            String atualizaPontos =
                "UPDATE usuarios " +
                "SET pontos = pontos + ? " +
                "WHERE id = ?";

            PreparedStatement pontosStmt =
                con.prepareStatement(atualizaPontos);

            pontosStmt.setInt(1, pontos);
            pontosStmt.setInt(2, usuarioId);

            pontosStmt.executeUpdate();

            String historico =
                "INSERT INTO historico_pontos " +
                "(usuario_id, acao, pontos_recebidos, saldo_atual) " +
                "VALUES (?, ?, ?, (SELECT pontos FROM usuarios WHERE id=?))";

            PreparedStatement hist =
                con.prepareStatement(historico);

            hist.setInt(1, usuarioId);
            hist.setString(2, "Compra realizada");
            hist.setInt(3, pontos);
            hist.setInt(4, usuarioId);

            hist.executeUpdate();

            compra.close();
            pontosStmt.close();
            hist.close();
            con.close();

            System.out.println("Compra registrada!");

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void main(String[] args) {

        cadastrarUsuario(
                "Natan Lima",
                "1234567891011",
                "43 98862-1086",
                "slnatan07@gmail.com",
                "10082007"
        );

        boolean login =
                login("slnatan07@gmail.com", "10082007");

        System.out.println("Login: " + login);

        registrarCompra(
                1,
                150.00,
                "Mercadinho Central",
                "Arroz, Feijão, Açúcar",
                "QR123456"
        );
    }
}