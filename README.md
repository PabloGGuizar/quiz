# **🚀 Quiz Interactivo: Exploradores del Sistema Solar**

Este proyecto es un sistema de cuestionario (quiz) ligero y seguro, diseñado con una arquitectura **Serverless**. Utiliza **GitHub Pages** para el frontend (interfaz de usuario) y **Google Apps Script \+ Google Sheets** como backend y base de datos.

## **🌟 Características Principales**

* **Autenticación sin contraseña:** Los usuarios solo ingresan un nombre de usuario. El servidor genera automáticamente un token único (UUID) la primera vez, lo guarda hasheado y lo entrega al navegador para que lo almacene en `localStorage`. En intentos posteriores, el token se envía y valida en el servidor sin que el usuario tenga que recordar nada.
* **Seguridad Antifraude:** La lógica de calificación y las respuestas correctas viven exclusivamente en Google Apps Script. El usuario nunca puede ver las respuestas inspeccionando el código del navegador.
* **Protección Avanzada:** Incorpora cifrado SHA-256 para tokens con un SALT global aleatorio almacenado en `PropertiesService`, protección contra fuerza bruta mediante `CacheService` (bloqueo por 15 min tras 5 fallos), mensajes descriptivos de error y protección total contra inyecciones de código (XSS y CSV/Formula Injections).
* **Tokens seguros en el servidor:** El SALT se genera aleatoriamente la primera vez que el script se ejecuta y se guarda de forma persistente en las Propiedades del Script, fuera del código fuente. Es imposible forjar un token válido sin conocer este SALT.
* **Nombres de usuario únicos:** Dos usuarios no pueden compartir el mismo nombre. Si alguien intenta usar un nombre ya registrado sin el token correcto (por ejemplo, desde un dispositivo diferente), el servidor lo rechaza.
* **Leaderboard con caché:** Al finalizar, se muestra un "Top 10" de los mejores puntajes. El leaderboard se almacena en caché por 60 segundos para evitar lecturas innecesarias a Google Sheets.
* **Control de Intentos:** Cada usuario tiene un máximo de 3 intentos. El sistema lleva el registro y bloquea intentos adicionales.
* **Base de Datos Gratuita:** Utiliza Google Sheets para almacenar usuarios, tokens, intentos y resultados en tiempo real.
* **Evasión de CORS:** Utiliza un envío de datos en formato `text/plain` para evadir las restricciones de CORS al comunicar GitHub Pages con Google Apps Script.
* **Diseño Glassmorphism:** Interfaz moderna y responsiva separada en módulos (HTML, CSS, JS).

## **🏗️ Arquitectura del Sistema**

El flujo de información funciona de la siguiente manera:

1. **Frontend (GitHub Pages):** El usuario ingresa su nombre de usuario. `script.js` busca en `localStorage` si existe un token asociado a ese nombre (`quiz_token_NombreUsuario`). Empaqueta el nombre, el token (si existe) y las respuestas en un JSON, y lo envía al backend mediante `fetch()`.
2. **Backend (Google Apps Script):** La función `doPost(e)` recibe la petición HTTP y orquesta las siguientes funciones auxiliares:
   * `parsearEntrada()`: Valida y sanitiza todos los campos recibidos (nombre, token, respuestas).
   * `verificarFuerzaBruta()`: Comprueba que el usuario no haya superado el límite de intentos fallidos.
   * `autenticarUsuario()`: Busca el nombre en la hoja. Si no existe, el usuario es nuevo. Si existe, verifica que el token enviado coincida con el hash guardado en la base de datos.
   * Si es **usuario nuevo**: genera un UUID, lo hashea con el SALT y lo guarda. Devuelve el UUID al frontend para guardarlo en `localStorage`.
   * Si es **usuario existente**: verifica intentos restantes y permite continuar.
   * `evaluarRespuestas()`: Califica el examen con las respuestas correctas ocultas en el servidor.
   * `construirLeaderboard()`: Devuelve el Top 10, usando caché cuando es posible.
3. **Base de Datos (Google Sheets):** Guarda o actualiza la fila del usuario y registra el intento en la hoja de Resultados.
4. **Respuesta:** El script devuelve un JSON con el puntaje, los intentos restantes, el leaderboard y (solo si es la primera vez) el token generado.

## **⚙️ Configuración e Instalación**

Para replicar o desplegar este proyecto en tu propia cuenta, sigue estos pasos:

### **1\. Configurar Google Sheets (Base de Datos)**

1. Crea un nuevo Google Sheet.
2. Nombra a la primera pestaña exactamente **Usuarios** y coloca los siguientes encabezados en la fila 1:
   * Columna A: `Username`
   * Columna B: `TokenHash`
   * Columna C: `Intentos_Restantes`
   * Columna D: `Mejor_Puntaje`
3. Crea una segunda pestaña llamada exactamente **Resultados** con estos encabezados en la fila 1:
   * Columna A: `Fecha`
   * Columna B: `Username`
   * Columna C: `Pregunta_1`
   * Columna D: `Pregunta_2`
   * Columna E: `Pregunta_3`
   * Columna F: `Puntaje_Obtenido`

> **Nota:** La columna de Email y Password del sistema anterior han sido eliminadas. La hoja ahora tiene 4 columnas en "Usuarios" (no 5). Si tienes datos anteriores, borra todos los registros de prueba (dejando solo los encabezados) antes de usar esta versión.

### **2\. Configurar Google Apps Script (Backend)**

1. En tu Google Sheet, ve al menú superior y selecciona **Extensiones > Apps Script**.
2. Borra el código por defecto y pega el contenido completo del archivo `apps-script.js`.
3. Haz clic en el botón azul **Implementar > Nueva implementación** (arriba a la derecha).
4. Configura el despliegue con estos parámetros exactos:
   * Selecciona el tipo de implementación: **Aplicación Web** (ícono de engranaje).
   * Ejecutar como: **Tú (tu correo)**
   * Quién tiene acceso: **Cualquier persona** *(Nota: Esto es crucial para evitar el bloqueo por políticas CORS).*
5. Haz clic en **Implementar**, autoriza los permisos de Google y copia la URL generada (termina en `/exec`).

> **El SALT se genera automáticamente.** No necesitas configurar ningún secreto manualmente. La primera vez que el script procese una petición, generará un SALT aleatorio y lo guardará en las Propiedades del Script de forma invisible y permanente.

### **3\. Configurar el Frontend (GitHub Pages)**

1. Clona este repositorio o asegúrate de tener los archivos `index.html`, `style.css` y `script.js` en tu entorno local.
2. Abre el archivo `script.js` y reemplaza el valor de la constante `GOOGLE_URL` con la URL que copiaste en el paso anterior:
   ```js
   const GOOGLE_URL = "https://script.google.com/macros/s/TU_ID_AQUI/exec";
   ```
3. Sube los cambios y haz push a tu repositorio en GitHub.
4. Ve a la sección **Settings > Pages** de tu repositorio. En *Source*, selecciona la rama `main` (o `master`) y guarda para publicar tu página web de forma gratuita.

## **📂 Estructura de Archivos**

| Archivo | Descripción |
|---|---|
| `index.html` | Estructura del formulario, preguntas del quiz y leaderboard. |
| `style.css` | Estilos visuales, animaciones y diseño glassmorphism responsivo. |
| `script.js` | Lógica del cliente: gestión del token en `localStorage`, comunicación con el backend vía `fetch()` y actualización del DOM. |
| `apps-script.js` | Backend serverless: autenticación por tokens, calificación segura, control de intentos y leaderboard con caché. |

## **🛡️ Notas de Seguridad**

* **Privacidad de la Base de Datos:** Mantén tu archivo de Google Sheets **estrictamente privado**. Solo la cuenta propietaria debe tener acceso directo. Apps Script actúa como puente público de forma segura.
* **Tokens hasheados con SALT:** Los tokens NUNCA se guardan en texto plano. El sistema aplica SHA-256 combinado con un SALT global aleatorio almacenado en las Propiedades del Script. Nadie puede reconstruir el token original a partir del hash guardado.
* **Imposible forjar tokens:** Cualquier token inventado por un atacante, al ser hasheado con el SALT secreto del servidor, producirá un hash diferente al guardado en la base de datos. La petición será rechazada.
* **Prevención de Ataques:**
  * **Fuerza Bruta:** Si alguien falla 5 veces seguidas el token de un mismo usuario, la cuenta se bloquea automáticamente por 15 minutos.
  * **Inyecciones (CSV / XSS):** Todas las entradas son validadas (Regex + límite de longitud) y desinfectadas antes de guardarse en Google Sheets.
  * **Valores inválidos en respuestas:** El servidor verifica que `p1`, `p2` y `p3` existan en el JSON y sean únicamente `"A"`, `"B"` o `"C"` antes de evaluarlos.
  * **Condiciones de Carrera (Race Conditions):** Uso de `LockService` para que el script procese las peticiones de una en una.
