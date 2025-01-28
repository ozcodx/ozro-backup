import { query } from '../services/mariadb.js';
import { getFirestoreDB } from '../services/firebase.js';

let lastPlayerCount = 0;

async function getOnlinePlayersCount() {
    try {
        const result = await query('SELECT COUNT(*) as count FROM `char` WHERE online = 1');
        return result[0].count;
    } catch (error) {
        console.error('Error al obtener el conteo de jugadores online:', error);
        return lastPlayerCount;
    }
}

async function updateFirestorePlayerCount(count) {
    // Si el conteo es igual al último, no hacemos nada
    if (count === lastPlayerCount) {
        return;
    }

    try {
        const db = getFirestoreDB();
        
        // Obtener el documento más reciente de server-status
        const serverStatusRef = db.collection('server-status');
        const snapshot = await serverStatusRef
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();

            // Si el número de jugadores es diferente, actualizar
            if (data.players !== count) {
                await doc.ref.update({
                    players: count,
                    timestamp: new Date()
                });
                console.log(`🔄 Actualizado conteo de jugadores en Firestore: ${count}`);
            }
        } else {
            // Si no hay documentos, crear uno nuevo
            await serverStatusRef.add({
                players: count,
                timestamp: new Date()
            });
            console.log(`🆕 Creado nuevo documento de estado con ${count} jugadores`);
        }
        lastPlayerCount = count;
    } catch (error) {
        console.error('Error al actualizar Firestore:', error);
    }
}

export async function startFirestoreSync() {
    console.log('🔄 Iniciando sincronización con Firestore...');
    
    // Primera ejecución inmediata
    const initialCount = await getOnlinePlayersCount();
    await updateFirestorePlayerCount(initialCount);

    // Configurar el intervalo de 10 segundos
    setInterval(async () => {
        const count = await getOnlinePlayersCount();
        await updateFirestorePlayerCount(count);
    }, 10000);
} 