import { query } from '../services/mariadb.js';
import { getFirestoreDB } from '../services/firebase.js';

let lastStats = null;

async function getAccountStats() {
    try {
        // Total de cuentas
        const totalResult = await query('SELECT COUNT(*) as count FROM login');
        const total = totalResult[0].count;

        // Cuentas activas en la última semana
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const formattedDate = weekAgo.toISOString().slice(0, 19).replace('T', ' ');
        
        const activeResult = await query(
            'SELECT COUNT(*) as count FROM login WHERE lastlogin >= ?',
            [formattedDate]
        );
        const activeLastWeek = activeResult[0].count;

        return {
            total,
            activeLastWeek
        };
    } catch (error) {
        console.error('Error al obtener estadísticas de cuentas:', error);
        return lastStats?.accounts || { total: 0, activeLastWeek: 0 };
    }
}

async function getCharacterStats() {
    try {
        // Total de personajes (excluyendo borrados)
        const totalResult = await query('SELECT COUNT(*) as count FROM `char` WHERE delete_date = 0');
        const total = totalResult[0].count;

        // Personajes activos en las últimas 24 horas
        const dayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
        const activeResult = await query(
            'SELECT COUNT(*) as count FROM `char` WHERE delete_date = 0 AND last_login >= ?',
            [dayAgo]
        );
        const activeLast24h = activeResult[0].count;

        // Nivel más alto y promedio
        const levelStats = await query(`
            SELECT 
                MAX(base_level) as maxLevel,
                AVG(base_level) as avgLevel,
                COUNT(*) as maxLevelCount
            FROM \`char\`
            WHERE delete_date = 0
            GROUP BY base_level
            HAVING base_level = (
                SELECT MAX(base_level)
                FROM \`char\`
                WHERE delete_date = 0
            )
        `);

        const highestLevel = levelStats[0]?.maxLevel || 0;
        const averageLevel = Math.round(levelStats[0]?.avgLevel || 0);
        const maxLevelCount = levelStats[0]?.maxLevelCount || 0;

        return {
            total,
            activeLast24h,
            highestLevel,
            averageLevel,
            maxLevelCount
        };
    } catch (error) {
        console.error('Error al obtener estadísticas de personajes:', error);
        return lastStats?.characters || {
            total: 0,
            activeLast24h: 0,
            highestLevel: 0,
            averageLevel: 0,
            maxLevelCount: 0
        };
    }
}

async function getGuildStats() {
    try {
        const result = await query('SELECT COUNT(*) as count FROM guild');
        return {
            total: result[0].count
        };
    } catch (error) {
        console.error('Error al obtener estadísticas de guilds:', error);
        return lastStats?.guilds || { total: 0 };
    }
}

async function getEconomyStats(totalCharacters, totalAccounts) {
    try {
        // Obtener la suma total de zeny de personajes y el zeny por cuenta
        const charZenyResult = await query(`
            SELECT 
                SUM(zeny) as totalCharZeny,
                account_id,
                SUM(zeny) as accountCharZeny
            FROM \`char\`
            WHERE delete_date = 0
            GROUP BY account_id
        `);

        // Obtener el zeny en los bancos
        const bankZenyResult = await query(`
            SELECT 
                account_id,
                bank_vault
            FROM account_data
        `);

        // Crear un mapa de cuenta -> zeny del banco
        const bankZenyMap = new Map();
        let totalBankZeny = BigInt(0);
        
        bankZenyResult.forEach(row => {
            const bankVault = BigInt(row.bank_vault || 0);
            bankZenyMap.set(row.account_id, bankVault);
            totalBankZeny += bankVault;
        });

        // Calcular totales y promedios por cuenta
        let totalCharZeny = BigInt(0);
        let totalZenyByAccount = new Map();

        charZenyResult.forEach(row => {
            const charZeny = BigInt(row.totalCharZeny || 0);
            totalCharZeny += charZeny;
            
            // Sumar zeny de personajes + banco para cada cuenta
            const bankZeny = bankZenyMap.get(row.account_id) || BigInt(0);
            const accountTotalZeny = BigInt(row.accountCharZeny || 0) + bankZeny;
            totalZenyByAccount.set(row.account_id, accountTotalZeny);
        });

        // Calcular el zeny total y promedios
        const totalZeny = totalCharZeny + totalBankZeny;
        
        // Convertir a número normal para los promedios, usando Number() para BigInt
        const averageZenyPerChar = totalCharacters > 0 
            ? Math.floor(Number(totalCharZeny) / totalCharacters)
            : 0;
        
        // Para el promedio por cuenta, solo consideramos cuentas que tienen personajes o dinero en el banco
        const accountsWithMoney = totalZenyByAccount.size;
        const totalZenyAllAccounts = Array.from(totalZenyByAccount.values())
            .reduce((a, b) => a + b, BigInt(0));
        
        const averageZenyPerAccount = accountsWithMoney > 0 
            ? Math.floor(Number(totalZenyAllAccounts) / accountsWithMoney)
            : 0;

        return {
            totalZeny: Number(totalZeny),
            bankZeny: Number(totalBankZeny),
            averageZenyPerChar,
            averageZenyPerAccount
        };
    } catch (error) {
        console.error('Error al obtener estadísticas económicas:', error);
        return lastStats?.economy || {
            totalZeny: 0,
            bankZeny: 0,
            averageZenyPerChar: 0,
            averageZenyPerAccount: 0
        };
    }
}

async function calculateServerStats() {
    try {
        // Obtener todas las estadísticas
        const accountStats = await getAccountStats();
        const characterStats = await getCharacterStats();
        const guildStats = await getGuildStats();
        const economyStats = await getEconomyStats(characterStats.total, accountStats.total);

        const stats = {
            timestamp: new Date(),
            accounts: accountStats,
            characters: characterStats,
            guilds: guildStats,
            economy: economyStats
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