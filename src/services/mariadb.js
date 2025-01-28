import mariadb from 'mariadb';

let pool;

export async function initializeMariaDB() {
    pool = mariadb.createPool({
        host: process.env.MARIADB_HOST,
        port: parseInt(process.env.MARIADB_PORT),
        user: process.env.MARIADB_USER,
        password: process.env.MARIADB_PASSWORD,
        database: process.env.MARIADB_DATABASE,
        connectionLimit: 5
    });

    try {
        const connection = await pool.getConnection();
        console.log('📦 Conexión a MariaDB establecida');
        connection.release();
    } catch (error) {
        console.error('Error al conectar con MariaDB:', error);
        throw error;
    }
}

export async function getConnection() {
    if (!pool) {
        throw new Error('Pool de MariaDB no inicializado');
    }
    return await pool.getConnection();
}

export async function query(sql, params) {
    const connection = await getConnection();
    try {
        return await connection.query(sql, params);
    } finally {
        connection.release();
    }
} 