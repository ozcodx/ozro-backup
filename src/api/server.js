import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';

const app = express();
const port = process.env.API_PORT || 3000;

app.use(express.json());

// Ruta básica de health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

export function startAPI() {
    return new Promise((resolve) => {
        try {
            // Cargar certificados SSL
            const options = {
                key: fs.readFileSync(process.env.SSL_KEY_PATH),
                cert: fs.readFileSync(process.env.SSL_CERT_PATH)
            };

            // Crear servidor HTTPS
            const server = https.createServer(options, app);

            server.listen(port, () => {
                console.log(`🔒 API HTTPS escuchando en el puerto ${port}`);
                resolve();
            });
        } catch (error) {
            console.error('Error al iniciar servidor HTTPS:', error);
            console.log('⚠️ Iniciando en modo HTTP por defecto...');
            
            // Fallback a HTTP si no hay certificados
            app.listen(port, () => {
                console.log(`🌐 API HTTP escuchando en el puerto ${port}`);
                resolve();
            });
        }
    });
} 