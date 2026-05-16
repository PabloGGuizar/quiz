# **🚀 Quiz Interactivo: Exploradores del Sistema Solar**

Este proyecto es un sistema de cuestionario (quiz) ligero y seguro, diseñado con una arquitectura **Serverless**. Utiliza **GitHub Pages** para el frontend (interfaz de usuario) y **Google Apps Script \+ Google Sheets** como backend y base de datos.

## **🌟 Características Principales**

* **Seguridad Antifraude:** La lógica de calificación y las respuestas correctas viven exclusivamente en Google Apps Script. El usuario nunca puede ver las respuestas inspeccionando el código del navegador.  
* **Base de Datos Gratuita:** Utiliza Google Sheets para almacenar usuarios, contraseñas, intentos y resultados en tiempo real.  
* **Control de Intentos:** Cada usuario tiene un máximo de 3 intentos. El sistema lleva el registro y bloquea intentos adicionales.  
* **Leaderboard Dinámico:** Al finalizar, se muestra un "Top 10" de los mejores puntajes de forma anónima (solo muestra el nombre de usuario, protegiendo correos y contraseñas).  
* **Evasión de CORS:** Utiliza un envío de datos en formato text/plain para evadir las restricciones de CORS al comunicar GitHub Pages (servidor estático) con Google Apps Script.  
* **Diseño Glassmorphism:** Interfaz moderna y responsiva separada en módulos (HTML, CSS, JS).

## **🏗️ Arquitectura del Sistema**

El flujo de información funciona de la siguiente manera:

1. **Frontend (GitHub Pages):** El usuario ingresa sus credenciales y respuestas en index.html. El archivo script.js empaqueta esto en un objeto JSON, lo convierte a texto y lo envía mediante fetch().  
2. **Backend (Google Apps Script):** La función doPost(e) recibe la petición HTTP.  
   * Verifica si el usuario existe o lo registra como nuevo.  
   * Valida la contraseña si el usuario ya existe.  
   * Verifica que al usuario le queden intentos disponibles.  
   * Califica el examen comparando las respuestas recibidas con las respuestas correctas ocultas en el código.  
   * Actualiza los intentos restantes y el mejor puntaje del usuario.  
3. **Base de Datos (Google Sheets):** Guarda una nueva fila con el resultado del intento actual y actualiza la hoja general de usuarios.  
4. **Respuesta:** El script devuelve un JSON con el puntaje obtenido y el tablero de posiciones actualizado al frontend para mostrarlos en la interfaz.

## **⚙️ Configuración e Instalación**

Para replicar o desplegar este proyecto en tu propia cuenta, sigue estos pasos:

### **1\. Configurar Google Sheets (Base de Datos)**

1. Crea un nuevo Google Sheet.  
2. Nombra a la primera pestaña exactamente **Usuarios** y coloca los siguientes encabezados en la fila 1:  
   * Columna A: Username  
   * Columna B: Email  
   * Columna C: Password  
   * Columna D: Intentos\_Restantes  
   * Columna E: Mejor\_Puntaje  
3. Crea una segunda pestaña llamada exactamente **Resultados** con estos encabezados en la fila 1:  
   * Columna A: Fecha  
   * Columna B: Username  
   * Columna C: Pregunta 1  
   * Columna D: Pregunta 2  
   * Columna E: Pregunta 3  
   * Columna F: Puntaje Obtenido

### **2\. Configurar Google Apps Script (Backend)**

1. En tu Google Sheet, ve al menú superior y selecciona **Extensiones \> Apps Script**.  
2. Borra el código por defecto y pega el código de backend (que contiene la función doPost(e)).  
3. Haz clic en el botón azul **Implementar \> Nueva implementación** (arriba a la derecha).  
4. Configura el despliegue con estos parámetros exactos:  
   * Selecciona el tipo de implementación: **Aplicación Web** (ícono de engranaje).  
   * Ejecutar como: **Tú (tu correo)**  
   * Quién tiene acceso: **Cualquier persona** *(Nota: Esto es crucial para evitar el bloqueo por políticas CORS).*  
5. Haz clic en **Implementar**, autoriza los permisos de Google y copia la URL generada (termina en /exec).

### **3\. Configurar el Frontend (GitHub Pages)**

1. Clona este repositorio o asegúrate de tener los archivos index.html, style.css y script.js en tu entorno local.  
2. Abre el archivo script.js y reemplaza el valor de la constante GOOGLE\_URL con la URL de la aplicación web que copiaste en el paso anterior:  
   const GOOGLE\_URL \= "\[https://script.google.com/macros/s/TU\_ID\_AQUI/exec\](https://script.google.com/macros/s/TU\_ID\_AQUI/exec)";

3. Sube los cambios y haz push a tu repositorio en GitHub.  
4. Ve a la sección **Settings \> Pages** de tu repositorio. En *Source*, selecciona la rama main (o master) y guarda para publicar tu página web de forma gratuita.

## **📂 Estructura de Archivos**

* index.html: Estructura principal del documento, contiene el formulario de registro/login, las preguntas del quiz y la estructura del leaderboard.  
* style.css: Estilos visuales, animaciones, esquema de colores oscuros con temática espacial (glassmorphism) y diseño adaptable a dispositivos móviles (responsive).  
* script.js: Lógica del lado del cliente. Maneja la recolección de datos del formulario, la validación básica, la comunicación asíncrona HTTP (fetch) con Google Apps Script y la actualización del DOM según las respuestas del servidor.

## **🛡️ Notas de Seguridad**

* Mantén tu archivo de Google Sheets **estrictamente privado**. Solo la cuenta propietaria (tú) debe tener acceso de lectura/escritura directo. Apps Script se encarga de hacer el puente público de forma segura.  
* Las contraseñas se guardan en texto plano en la hoja de cálculo. Dado que es un proyecto educativo o básico, esta medida es funcional, pero para sistemas en producción real se recomienda encarecidamente implementar *hashing* de contraseñas (ej. SHA-256) antes de almacenarlas o usar un proveedor de autenticación.