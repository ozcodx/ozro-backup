import cron from 'node-cron';
import fs from 'fs/promises';
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

async function performBackup(table) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = './backups';
        
        // Crear directorio de backups si no existe
        await fs.mkdir(backupDir, { recursive: true });
        
        // Obtener datos de la tabla
        const rows = await query(`SELECT * FROM ${table}`);
        
        // Guardar en archivo
        const backupPath = `${backupDir}/${table}_${timestamp}.json`;
        await fs.writeFile(backupPath, JSON.stringify(rows, null, 2));
        
        console.log(`✅ Backup completado para ${table}: ${backupPath}`);
    } catch (error) {
        console.error(`Error al realizar backup de ${table}:`, error);
    }
}

export async function initializeBackupTask() {
    // Programar tarea para ejecutarse cada día a las 3 AM
    cron.schedule('0 3 * * *', async () => {
        console.log('🔄 Iniciando proceso de backup...');
        const tables = await readBackupConfig();
        
        for (const table of tables) {
            await performBackup(table);
        }
    });
    
    console.log('📅 Tarea de backup programada para las 3 AM');
} 