# Ozro Backup

Sistema de backup y sincronización entre MariaDB y Firestore.

## Características

- API REST para monitoreo y control
- Backup automático de tablas MariaDB configurables
- Sincronización de logins entre Firestore y MariaDB
- Tareas programadas integradas

## Requisitos

- Node.js 18 o superior
- MariaDB
- Cuenta de Firebase con Firestore

## Configuración

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
   - Copia `.env.example` a `.env`
   ```bash
   cp .env.example .env
   ```
   - Configura las variables en `.env`:
     - Variables de Firebase
     - Variables de MariaDB
     - Variables de Firebase Admin SDK

3. Configurar Firebase Admin SDK:
   - Ve a la [Consola de Firebase](https://console.firebase.google.com/)
   - Selecciona tu proyecto
   - Ve a Configuración del Proyecto (⚙️)
   - Ve a la pestaña "Cuentas de servicio"
   - Selecciona "Firebase Admin SDK"
   - Haz clic en "Generar nueva clave privada"
   - Del archivo JSON descargado, copia los valores:
     - `client_email` a FIREBASE_CLIENT_EMAIL
     - `private_key` a FIREBASE_PRIVATE_KEY

4. Crear archivo `backup.conf` con las tablas a respaldar:
```
# Una tabla por línea
usuarios
productos
ventas
```

## Uso

Iniciar el servidor:
```bash
npm start
```

Para desarrollo con recarga automática:
```bash
npm run dev
```

## Estructura del Proyecto

```
src/
  ├── api/           # API REST
  ├── services/      # Servicios de conexión (MariaDB, Firebase)
  └── tasks/         # Tareas programadas
```

## API Endpoints

- `GET /health` - Health check del servicio

## Backups

Los backups se realizan automáticamente a las 3 AM para todas las tablas listadas en `backup.conf`.
Los archivos de backup se guardan en el directorio `backups/` en formato JSON. 