import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db;

export async function initializeFirebase() {
    try {
        const app = initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Nota: Necesitarás generar y añadir la private key desde la consola de Firebase
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            }),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        });

        db = getFirestore(app);
        console.log('🔥 Conexión a Firebase establecida');
    } catch (error) {
        console.error('Error al conectar con Firebase:', error);
        throw error;
    }
}

export function getFirestoreDB() {
    if (!db) {
        throw new Error('Firestore no inicializado');
    }
    return db;
}

// Función para escuchar cambios en una colección
export function listenToCollection(collectionName, callback) {
    return db.collection(collectionName)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    callback(change.doc.data(), change.doc.id);
                }
            });
        }, error => {
            console.error(`Error al escuchar la colección ${collectionName}:`, error);
        });
} 