import { query } from '../services/mariadb.js';
import { getFirestoreDB } from '../services/firebase.js';
import crypto from 'crypto';

let lastChecksum = '';

async function getMvpCardIds() {
    try {
        const result = await query(`
            SELECT DISTINCT DropCardid 
            FROM mob_db 
            WHERE MEXP > 0 AND DropCardid > 0
        `);
        return result.map(row => row.DropCardid);
    } catch (error) {
        console.error('Error al obtener IDs de cartas MVP:', error);
        return [];
    }
}

async function getAccountRankings() {
    try {
        const mvpCardIds = await getMvpCardIds();
        const mvpCardsStr = mvpCardIds.join(',');

        const rankings = await query(`
            WITH AccountItems AS (
                -- Items en storage
                SELECT ac.account_id, 
                    COALESCE(s.nameid, 0) as item_id,
                    COALESCE(s.amount, 0) as amount,
                    'storage' as source
                FROM login ac
                LEFT JOIN storage s ON ac.account_id = s.account_id
                WHERE ac.group_id != 99
                
                UNION ALL
                
                -- Items en inventory de cada personaje
                SELECT ac.account_id,
                    COALESCE(i.nameid, 0) as item_id,
                    COALESCE(i.amount, 0) as amount,
                    'inventory' as source
                FROM login ac
                JOIN \`char\` c ON ac.account_id = c.account_id
                LEFT JOIN inventory i ON c.char_id = i.char_id
                WHERE ac.group_id != 99 AND c.delete_date = 0
                
                UNION ALL
                
                -- Items en cart_inventory de cada personaje
                SELECT ac.account_id,
                    COALESCE(ci.nameid, 0) as item_id,
                    COALESCE(ci.amount, 0) as amount,
                    'cart' as source
                FROM login ac
                JOIN \`char\` c ON ac.account_id = c.account_id
                LEFT JOIN cart_inventory ci ON c.char_id = ci.char_id
                WHERE ac.group_id != 99 AND c.delete_date = 0
            ),
            AccountTotals AS (
                SELECT 
                    l.account_id,
                    l.userid,
                    l.logincount,
                    -- Zeny total (personajes + banco)
                    CAST((
                        SELECT COALESCE(SUM(c.zeny), 0)
                        FROM \`char\` c
                        WHERE c.account_id = l.account_id
                        AND c.delete_date = 0
                    ) + COALESCE(ad.bank_vault, 0) AS CHAR) as total_zeny,
                    -- Total de cartas
                    CAST((
                        SELECT COALESCE(SUM(amount), 0)
                        FROM AccountItems ai
                        WHERE ai.account_id = l.account_id
                        AND EXISTS (SELECT 1 FROM item_db WHERE id = ai.item_id AND type = 6)
                    ) AS CHAR) as total_cards,
                    -- Total de cartas MVP
                    CAST((
                        SELECT COALESCE(SUM(amount), 0)
                        FROM AccountItems ai
                        WHERE ai.account_id = l.account_id
                        AND ai.item_id IN (${mvpCardsStr})
                    ) AS CHAR) as total_mvp_cards,
                    -- Total de diamantes
                    CAST((
                        SELECT COALESCE(SUM(amount), 0)
                        FROM AccountItems ai
                        WHERE ai.account_id = l.account_id
                        AND ai.item_id = 6024
                    ) AS CHAR) as total_diamonds
                FROM login l
                LEFT JOIN account_data ad ON l.account_id = ad.account_id
                WHERE l.group_id != 99
            )
            SELECT 
                account_id,
                userid,
                logincount,
                total_zeny,
                total_cards,
                total_mvp_cards,
                total_diamonds
            FROM AccountTotals
            ORDER BY CAST(total_zeny AS DECIMAL(20)) DESC
        `);

        return rankings.map(row => ({
            account_id: row.account_id,
            userid: row.userid,
            logincount: row.logincount,
            total_zeny: row.total_zeny,
            total_cards: row.total_cards,
            total_mvp_cards: row.total_mvp_cards,
            total_diamonds: row.total_diamonds
        }));
    } catch (error) {
        console.error('Error al obtener rankings de cuentas:', error);
        return [];
    }
}

async function getCharacterRankings() {
    try {
        const rankings = await query(`
            SELECT 
                c.char_id,
                c.account_id,
                l.userid,
                c.name,
                c.class,
                c.base_level,
                CAST(c.base_exp AS CHAR) as base_exp,
                CAST(c.job_exp AS CHAR) as job_exp,
                c.fame
            FROM \`char\` c
            JOIN login l ON c.account_id = l.account_id
            WHERE c.delete_date = 0
            AND l.group_id != 99
            ORDER BY c.base_level DESC, c.base_exp DESC
        `);

        // Obtener rankings por clase
        const classByLevel = await query(`
            SELECT 
                c.class,
                c.char_id,
                c.account_id,
                l.userid,
                c.name,
                c.base_level,
                CAST(c.base_exp AS CHAR) as base_exp,
                CAST(c.job_exp AS CHAR) as job_exp,
                c.fame
            FROM \`char\` c
            JOIN login l ON c.account_id = l.account_id
            WHERE c.delete_date = 0
            AND l.group_id != 99
            ORDER BY c.class, c.base_level DESC, c.base_exp DESC
        `);

        // Agrupar personajes por clase
        const rankingsByClass = {};
        classByLevel.forEach(char => {
            if (!rankingsByClass[char.class]) {
                rankingsByClass[char.class] = [];
            }
            rankingsByClass[char.class].push({
                char_id: char.char_id,
                account_id: char.account_id,
                userid: char.userid,
                name: char.name,
                base_level: char.base_level,
                base_exp: char.base_exp,
                job_exp: char.job_exp,
                fame: char.fame
            });
        });

        return {
            overall: rankings.map(row => ({
                char_id: row.char_id,
                account_id: row.account_id,
                userid: row.userid,
                name: row.name,
                class: row.class,
                base_level: row.base_level,
                base_exp: row.base_exp,
                job_exp: row.job_exp,
                fame: row.fame
            })),
            byClass: rankingsByClass
        };
    } catch (error) {
        console.error('Error al obtener rankings de personajes:', error);
        return {
            overall: [],
            byClass: {}
        };
    }
}

function calculateChecksum(data) {
    return crypto
        .createHash('md5')
        .update(JSON.stringify(data))
        .digest('hex');
}

async function updateFirestoreRankings(rankings) {
    const newChecksum = calculateChecksum(rankings);
    
    if (newChecksum === lastChecksum) {
        console.log('📊 Rankings sin cambios, omitiendo actualización');
        return;
    }

    try {
        const db = getFirestoreDB();
        const rankingsRef = db.collection('rankings');
        
        await rankingsRef.add({
            ...rankings,
            timestamp: new Date()
        });

        lastChecksum = newChecksum;
        console.log('📊 Rankings actualizados en Firestore');
    } catch (error) {
        console.error('Error al actualizar rankings en Firestore:', error);
    }
}

async function generateRankings() {
    try {
        const [accountRankings, characterRankings] = await Promise.all([
            getAccountRankings(),
            getCharacterRankings()
        ]);

        return {
            accounts: accountRankings,
            characters: characterRankings
        };
    } catch (error) {
        console.error('Error al generar rankings:', error);
        return null;
    }
}

export async function startRankingsSync() {
    console.log('📊 Iniciando sincronización de rankings...');
    
    // Primera ejecución inmediata
    const initialRankings = await generateRankings();
    if (initialRankings) {
        await updateFirestoreRankings(initialRankings);
    }

    // Configurar el intervalo para ejecutar en cada hora en punto
    const now = new Date();
    const delay = 3600000 - (now.getMinutes() * 60 + now.getSeconds()) * 1000 - now.getMilliseconds();
    
    setTimeout(() => {
        // Primera ejecución en punto
        generateRankings().then(rankings => {
            if (rankings) updateFirestoreRankings(rankings);
        });

        // Configurar intervalo de 1 hora
        setInterval(async () => {
            const rankings = await generateRankings();
            if (rankings) await updateFirestoreRankings(rankings);
        }, 3600000);
    }, delay);
} 