import { listenToCollection } from '../services/firebase.js';
import { query } from '../services/mariadb.js';

async function createLoginInDB(loginData, docId) {
    try {
        // Primero verificamos si el usuario ya existe
        const checkUser = await query('SELECT account_id FROM login WHERE userid = ?', [loginData.userid]);
        
        if (checkUser.length > 0) {
            // Si el usuario ya existe, do nothing
            console.log(`❌ Usuario ya existe: ${loginData.userid}`);
        } else {
            // Si el usuario no existe, lo creamos
            const sql = `
                INSERT INTO login (
                    userid,
                    user_pass,
                    sex,
                    email,
                    group_id,
                    state,
                    lastlogin,
                    last_ip,
                    character_slots
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            // Procesar lastLogin
            let lastLogin = null;
            if (loginData.lastLogin) {
                try {
                    lastLogin = new Date(loginData.lastLogin);
                    // Verificar si la fecha es válida
                    if (isNaN(lastLogin.getTime())) {
                        lastLogin = null;
                    }
                } catch (e) {
                    lastLogin = null;
                }
            }
            
            await query(sql, [
                loginData.userid,
                loginData.password || '',  // Asumiendo que viene hasheada de Firebase
                loginData.sex || 'M',
                loginData.email || 'a@a.com',
                0,  // group_id default
                0,  // state default
                lastLogin,  // Ahora manejamos correctamente el caso nulo
                loginData.ip || '127.0.0.1',
                0   // character_slots default
            ]);
            
            console.log(`✅ Nuevo usuario creado: ${loginData.userid}`);
        }
    } catch (error) {
        console.error('Error al sincronizar login:', error);
        // Loguear más detalles del error para debugging
        if (error.sql) {
            console.error('SQL Query:', error.sql);
            console.error('SQL Message:', error.sqlMessage);
        }
    }
}

export async function initializeLoginSync() {
    // Asegurar que la tabla existe con la estructura correcta
    await query(`
        CREATE TABLE IF NOT EXISTS login (
            account_id int(10) unsigned NOT NULL AUTO_INCREMENT,
            userid varchar(23) NOT NULL,
            user_pass varchar(32) NOT NULL DEFAULT '',
            sex enum('M','F','S') NOT NULL DEFAULT 'M',
            email varchar(39) NOT NULL DEFAULT '',
            group_id tinyint(4) NOT NULL DEFAULT 0,
            state int(10) unsigned NOT NULL DEFAULT 0,
            unban_time int(10) unsigned NOT NULL DEFAULT 0,
            expiration_time int(10) unsigned NOT NULL DEFAULT 0,
            logincount mediumint(8) unsigned NOT NULL DEFAULT 0,
            lastlogin datetime DEFAULT NULL,
            last_ip varchar(100) NOT NULL DEFAULT '',
            birthdate date DEFAULT NULL,
            character_slots tinyint(3) unsigned NOT NULL DEFAULT 0,
            pincode varchar(4) NOT NULL DEFAULT '',
            pincode_change int(10) unsigned NOT NULL DEFAULT 0,
            PRIMARY KEY (account_id),
            UNIQUE KEY name (userid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // Iniciar escucha de nuevos logins en Firestore
    listenToCollection('login', async (loginData, docId) => {
        await createLoginInDB(loginData, docId);
    });
    
    console.log('👂 Escuchando nuevos logins en Firestore');
}