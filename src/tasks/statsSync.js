import { query } from '../services/mariadb.js';
import { getFirestoreDB } from '../services/firebase.js';

let lastStats = null;

async function calculateServerStats() {
    try {
        // Aquí irán todas las consultas para obtener las estadísticas
        // Por ahora retornamos un objeto base que expandiremos después
        const stats = {
            timestamp: new Date(),
            accounts: {
                total: 0,
                activeLastWeek: 0
            },
            characters: {
                total: 0,
                activeLast24h: 0,
                highestLevel: 0,
                averageLevel: 0
            },
            guilds: {
                total: 0
            },
            economy: {
                totalZeny: 0,
                serverZeny: 0,
                averageZenyPerChar: 0,
                averageZenyPerAccount: 0
            }
        };

        return stats;
    } catch (error) {
        console.error('Error al calcular estadísticas del servidor:', error);
        return lastStats || null;
    }
}

function statsHaveChanged(newStats, oldStats) {
    if (!oldStats) return true;
    
    // Comparación profunda de las estadísticas, ignorando el timestamp
    const newStatsCopy = { ...newStats };
    const oldStatsCopy = { ...oldStats };
    
    delete newStatsCopy.timestamp;
    delete oldStatsCopy.timestamp;
    
    return JSON.stringify(newStatsCopy) !== JSON.stringify(oldStatsCopy);
}

async function updateFirestoreStats(stats) {
    if (!stats || (lastStats && !statsHaveChanged(stats, lastStats))) {
        return;
    }

    try {
        const db = getFirestoreDB();
        const serverDataRef = db.collection('server-data');
        
        await serverDataRef.add(stats);
        console.log('📊 Estadísticas del servidor actualizadas en Firestore');
        
        lastStats = stats;
    } catch (error) {
        console.error('Error al actualizar estadísticas en Firestore:', error);
    }
}

export async function startStatsSync() {
    console.log('📊 Iniciando sincronización de estadísticas...');
    
    // Primera ejecución inmediata
    const initialStats = await calculateServerStats();
    await updateFirestoreStats(initialStats);

    // Configurar el intervalo de 1 hora (3600000 ms)
    setInterval(async () => {
        const stats = await calculateServerStats();
        await updateFirestoreStats(stats);
    }, 3600000);
} 