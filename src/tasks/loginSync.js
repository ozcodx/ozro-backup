import { listenToCollection } from '../services/firebase.js';
import { query } from '../services/mariadb.js';

async function createLoginInDB(loginData, docId) {
    try {
        const sql = `
            INSERT INTO login (
                firebase_id,
                email,
                created_at,
                last_login
            ) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                last_login = VALUES(last_login)
        `;
        
        await query(sql, [
            docId,
            loginData.email,
            new Date(loginData.createdAt),
            new Date(loginData.lastLogin)
        ]);
        
        console.log(`✅ Login sincronizado para usuario: ${loginData.email}`);
    } catch (error) {
        console.error('Error al sincronizar login:', error);
    }
}

export async function initializeLoginSync() {
    // Asegurar que la tabla existe
    await query(`
        CREATE TABLE IF NOT EXISTS login (
            id INT AUTO_INCREMENT PRIMARY KEY,
            firebase_id VARCHAR(255) UNIQUE,
            email VARCHAR(255),
            created_at DATETIME,
            last_login DATETIME,
            INDEX idx_firebase_id (firebase_id)
        )
    `);
    
    // Iniciar escucha de nuevos logins en Firestore
    listenToCollection('login', async (loginData, docId) => {
        await createLoginInDB(loginData, docId);
    });
    
    console.log('👂 Escuchando nuevos logins en Firestore');
} 