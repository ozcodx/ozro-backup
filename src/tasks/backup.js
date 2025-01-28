import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { query } from '../services/mariadb.js';

async function readBackupConfig() {
    try {
        const configContent = await fs.readFile('backup.conf', 'utf-8');
        return configContent.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    } catch (error) {
        console.error('Error al leer backup.conf:', error);
        return [];
    }
}

function getBackupFolderName() {
    const now = new Date();
    return now.getFullYear().toString() +
           (now.getMonth() + 1).toString().padStart(2, '0') +
           now.getDate().toString().padStart(2, '0') +
           now.getHours().toString().padStart(2, '0') +
           now.getMinutes().toString().padStart(2, '0') +
           now.getSeconds().toString().padStart(2, '0');
}

function generateSQLInsert(tableName, rows) {
    if (rows.length === 0) return '';
    
    // Obtener los nombres de las columnas del primer registro
    const columns = Object.keys(rows[0]);
    
    // Generar la parte INSERT INTO de la consulta
    let sql = `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES\n`;
    
    // Generar los valores para cada fila
    const values = rows.map(row => {
        const rowValues = columns.map(column => {
            const value = row[column];
            if (value === null) return 'NULL';
            if (typeof value === 'number') return value;
            if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
            return `'${value.toString().replace(/'/g, "''")}'`;
        });
        return `(${rowValues.join(', ')})`;
    });
    
    // Unir todo y añadir punto y coma al final
    return sql + values.join(',\n') + ';\n';
}

async function performBackup() {
    try {
        const timestamp = getBackupFolderName();
        const backupDir = path.join('./backups', timestamp);
        
        // Crear directorios para JSON y SQL
        const jsonDir = path.join(backupDir, 'json');
        const sqlDir = path.join(backupDir, 'sql');
        await fs.mkdir(jsonDir, { recursive: true });
        await fs.mkdir(sqlDir, { recursive: true });
        
        // Obtener lista de tablas
        const tables = await readBackupConfig();
        let backupCount = 0;
        
        // Archivo SQL combinado para todas las tablas
        let combinedSQL = '';
        
        for (const table of tables) {
            try {
                // Obtener datos de la tabla
                const rows = await query(`SELECT * FROM ${table}`);
                
                // Guardar JSON
                const jsonPath = path.join(jsonDir, `${table}.json`);
                await fs.writeFile(jsonPath, JSON.stringify(rows, null, 2));
                
                // Generar y guardar SQL individual
                const sqlInsert = generateSQLInsert(table, rows);
                const sqlPath = path.join(sqlDir, `${table}.sql`);
                await fs.writeFile(sqlPath, sqlInsert);
                
                // Añadir al SQL combinado
                combinedSQL += `-- Tabla: ${table}\n${sqlInsert}\n`;
                
                console.log(`✅ Backup completado para ${table} (JSON y SQL)`);
                backupCount++;
            } catch (error) {
                console.error(`Error al realizar backup de ${table}:`, error);
            }
        }
        
        // Guardar SQL combinado
        if (combinedSQL) {
            const combinedSQLPath = path.join(backupDir, 'full_backup.sql');
            await fs.writeFile(combinedSQLPath, combinedSQL);
        }
        
        console.log(`📦 Backup completado en ${backupDir} (${backupCount} tablas)`);
        return backupCount;
    } catch (error) {
        console.error('Error al realizar backup:', error);
        return 0;
    }
}

export async function initializeBackupTask() {
    // Realizar backup inicial
    console.log('🔄 Iniciando backup inicial...');
    const tablesBackedUp = await performBackup();
    
    if (tablesBackedUp > 0) {
        console.log('✨ Backup inicial completado exitosamente');
    } else {
        console.warn('⚠️ No se pudo realizar el backup inicial');
    }
    
    // Programar tarea para ejecutarse cada día a las 3 AM
    cron.schedule('0 3 * * *', async () => {
        console.log('🔄 Iniciando proceso de backup programado...');
        await performBackup();
    });
    
    console.log('📅 Tarea de backup programada para las 3 AM');
} 