import 'dotenv/config';
import { startAPI } from './api/server.js';
import { initializeFirebase } from './services/firebase.js';
import { initializeMariaDB } from './services/mariadb.js';
import { initializeTasks } from './tasks/index.js';

async function main() {
    try {
        // Inicializar conexiones a bases de datos
        await initializeMariaDB();
        await initializeFirebase();

        // Iniciar tareas programadas
        await initializeTasks();

        // Iniciar API
        await startAPI();

        console.log('🚀 Todos los servicios iniciados correctamente');
    } catch (error) {
        console.error('Error al iniciar los servicios:', error);
        process.exit(1);
    }
}

main(); 