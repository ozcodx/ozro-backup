import express from 'express';

const app = express();
const port = process.env.API_PORT || 3000;

app.use(express.json());

// Ruta básica de health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

export function startAPI() {
    return new Promise((resolve) => {
        app.listen(port, () => {
            console.log(`🌐 API escuchando en el puerto ${port}`);
            resolve();
        });
    });
} 