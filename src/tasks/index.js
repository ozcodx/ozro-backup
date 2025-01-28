import { initializeBackupTask } from './backup.js';
import { startPlayersSync } from './playersSync.js';
import { initializeLoginSync } from './loginSync.js';
import { startStatsSync } from './statsSync.js';

export async function initializeTasks() {
    try {
        // Iniciar tarea de backup
        await initializeBackupTask();
        
        // Iniciar sincronización de jugadores online
        await startPlayersSync();
        
        // Iniciar sincronización de logins
        await initializeLoginSync();

        // Iniciar sincronización de estadísticas
        await startStatsSync();
        
        console.log('⏰ Tareas programadas iniciadas');
    } catch (error) {
        console.error('Error al iniciar las tareas:', error);
        throw error;
    }
} 