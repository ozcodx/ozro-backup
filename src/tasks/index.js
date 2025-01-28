import { initializeBackupTask } from './backup.js';
import { startFirestoreSync } from './firestoreSync.js';
import { initializeLoginSync } from './loginSync.js';

export async function initializeTasks() {
    try {
        // Iniciar tarea de backup
        await initializeBackupTask();
        
        // Iniciar tarea de sincronización con Firestore
        await startFirestoreSync();
        
        // Iniciar sincronización de logins
        await initializeLoginSync();
        
        console.log('⏰ Tareas programadas iniciadas');
    } catch (error) {
        console.error('Error al iniciar las tareas:', error);
        throw error;
    }
} 