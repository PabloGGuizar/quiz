# Lista de Cotejo de Seguridad: Google Sheets como Base de Datos

Prácticas esenciales para cualquier aplicación que use **Google Apps Script** con **Google Sheets** como base de datos.

---

## Arquitectura del Modelo

Este patrón conecta tres capas independientes:

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| **Frontend** | HTML + JS estático (ej. GitHub Pages) | Interfaz del usuario. Envía y recibe datos, nunca toca la hoja directamente. |
| **Backend** | Google Apps Script | Valida, procesa y escribe. Es el único punto de contacto con la hoja. |
| **Base de datos** | Google Sheets | Almacena los datos. Solo el script puede leerla o modificarla. |

**Flujo de una petición:**
```
Usuario → fetch() desde el frontend
        → Apps Script (valida, procesa)
        → Lee / escribe en Google Sheets
        → Devuelve JSON al frontend
```

> **Nota sobre CORS:** Apps Script no acepta peticiones con `Content-Type: application/json` desde dominios externos. Para evitar el bloqueo del navegador, el frontend debe enviar el cuerpo como `Content-Type: text/plain` (aunque el contenido sea JSON válido). El script lo parsea normalmente con `JSON.parse(e.postData.contents)`.

---

## 1. Protección de Datos y Credenciales

- [ ] **Guardar secretos en Script Properties, no en el código.**
  - Usar `PropertiesService.getScriptProperties()` para claves, SALTs o cualquier valor sensible.
  - *Si el código es público (ej. GitHub), cualquier secreto escrito directamente en él queda expuesto.*

- [ ] **Nunca guardar tokens o contraseñas en texto plano en la hoja.**
  - Aplicar un hash criptográfico (SHA-256) combinado con un SALT antes de escribir en Sheets.
  - *El hash es irreversible: aunque alguien acceda a la hoja, no puede usar el valor directamente.*

- [ ] **Implementar caducidad y renovación automática de tokens.**
  - Definir un tiempo de vida (ej. 7 días) y renovar el token cuando expire.
  - *Un token que nunca caduca es un riesgo permanente si alguna vez es comprometido.*

---

## 2. Validación y Sanitización de Entradas

- [ ] **Verificar el tamaño del cuerpo de la petición antes de procesarla.**
  - Comprobar el tamaño de `e.postData.contents` antes de hacer `JSON.parse()`.
  - Si supera un umbral razonable (ej. 10 KB), rechazar la petición inmediatamente.
  - *Previene que payloads gigantes agoten la memoria o el tiempo de ejecución del script.*

- [ ] **Validar tipo, longitud y formato de cada campo recibido.**
  - Verificar que cada parámetro tenga el tipo esperado y no supere la longitud máxima.
  - Usar listas blancas de valores permitidos cuando sea posible (ej. solo `"A"`, `"B"`, `"C"`).
  - *Un campo sin validar es una puerta de entrada para datos maliciosos o malformados.*

- [ ] **Sanitizar textos antes de escribirlos en la hoja (CSV Injection).**
  - Si un valor comienza con `=`, `+`, `-` o `@`, anteponer un apóstrofo `'`.
  - *Google Sheets interpreta esos caracteres como fórmulas; sin sanitización, un usuario podría inyectar fórmulas maliciosas en la hoja.*

- [ ] **Usar listas blancas de caracteres (Regex) en campos de texto libre.**
  - Definir exactamente qué caracteres son permitidos (letras, números, espacios, acentos).
  - Rechazar cualquier valor que contenga caracteres fuera de ese conjunto.

---

## 3. Control de Acceso y Protección contra Abusos

- [ ] **Limitar los intentos fallidos con un bloqueo temporal (Anti fuerza bruta).**
  - Usar `CacheService` para contar intentos fallidos por usuario.
  - Bloquear temporalmente (ej. 15 minutos) si se supera el límite (ej. 5 intentos).
  - *Previene que un atacante pruebe tokens o credenciales de forma masiva y automatizada.*

- [ ] **Usar `LockService` para evitar condiciones de carrera.**
  - Adquirir un bloqueo exclusivo al inicio de cada operación de lectura-escritura.
  - *Si dos peticiones llegan al mismo tiempo, sin bloqueo pueden leer el mismo dato y sobreescribirse mutuamente, corrompiendo la hoja.*

---

## 4. Lógica de Negocio y Arquitectura

- [ ] **Toda la lógica crítica debe ejecutarse en el servidor (Apps Script), no en el frontend.**
  - Las evaluaciones, cálculos de puntaje y validaciones de acceso no deben estar en el JavaScript del navegador.
  - *El código del navegador es visible e interceptable por cualquier usuario.*

- [ ] **Devolver al cliente solo la información mínima necesaria.**
  - No incluir en la respuesta hashes internos, IDs de fila, ni columnas auxiliares de la hoja.
  - *Cada dato extra expuesto es información que un atacante puede usar para entender la estructura del sistema.*

- [ ] **Capturar todos los errores con `try...catch` y devolver mensajes genéricos.**
  - Mostrar al usuario solo `{ estado: "error", mensaje: "..." }` sin detalles internos.
  - *Los mensajes de error detallados (traza del script, nombres de variables) son útiles para un atacante.*

---

## 5. Resiliencia y Optimización de Cuotas

- [ ] **Usar `CacheService` para respuestas frecuentes (ej. leaderboard).**
  - Almacenar en caché los datos que no cambian en cada petición, con un TTL razonable (ej. 60 s).
  - *Reduce el número de lecturas a Sheets, que tiene cuotas diarias. Una saturación de cuota deja la aplicación inoperativa.*

- [ ] **Invalidar el caché siempre que se escriban datos nuevos en la hoja.**
  - Llamar a `cache.remove(key)` inmediatamente después de cualquier escritura relevante.
  - *Si no se invalida, los usuarios verán datos desactualizados hasta que el caché expire solo.*

---

## 6. Protección de la Hoja de Cálculo

- [ ] **Proteger los rangos críticos desde la configuración de Sheets.**
  - Usar *Datos → Proteger hojas y rangos* para bloquear las columnas sensibles (ej. `TokenHash`, `Intentos`, `MejorPuntaje`).
  - *Un colaborador con acceso al Spreadsheet podría modificar esos datos directamente y saltarse todas las validaciones del script.*

---

## 7. Gestión del Deployment (Apps Script)

- [ ] **Crear siempre una nueva implementación al publicar cambios.**
  - Usar el botón *"Nueva implementación"* en lugar de editar la versión existente.
  - *Cada versión publicada queda congelada. Si solo guardas el código sin crear una versión nueva, el endpoint puede servir código incompleto.*

- [ ] **Revocar los deployments antiguos que ya no estén en uso.**
  - Desde *Apps Script → Implementaciones*, archivar o eliminar versiones anteriores.
  - *Un deployment antiguo con código vulnerable sigue siendo un endpoint activo y explotable aunque hayas publicado una versión nueva.*

---

## 8. Seguridad en el Frontend

- [ ] **Configurar una Content Security Policy (CSP) en el `<head>` del HTML.**
  - Directivas mínimas recomendadas:
    - `default-src 'none'` — bloquea todo por defecto.
    - `script-src 'self'` — solo scripts propios; sin scripts externos ni código inline.
    - `style-src 'self'` — solo CSS propio.
    - `connect-src https://script.google.com https://script.googleusercontent.com` — solo permite `fetch` hacia Apps Script.
    - `form-action 'self'` — los formularios no pueden enviarse a dominios externos.
  - *Reduce drásticamente el riesgo de XSS y, como efecto secundario, protege el `localStorage` al impedir que scripts externos se ejecuten.*

- [ ] **Nunca incluir respuestas correctas ni lógica de evaluación en el frontend.**
  - Todo el procesamiento debe ocurrir en Apps Script.
  - *El JavaScript del navegador es visible para cualquier usuario con DevTools.*

- [ ] **Usar `textContent` en lugar de `innerHTML` al renderizar datos del servidor.**
  - Al mostrar nombres de usuario, puntajes u otros datos recibidos, insertar siempre con `textContent`.
  - *`innerHTML` interpreta el texto como HTML; un nombre como `<script>alert(1)</script>` se ejecutaría en la página de otros usuarios (XSS).*

- [ ] **Elegir entre `localStorage` y `sessionStorage` según la necesidad del token.**
  - `localStorage` → persiste aunque se cierre el navegador. Usar si el token debe sobrevivir entre visitas.
  - `sessionStorage` → se borra al cerrar la pestaña. Preferible si la sesión no necesita persistir.
  - Ambos tienen la misma vulnerabilidad ante scripts maliciosos; la CSP es la capa que mitiga ese riesgo.
  - *Nunca guardar contraseñas ni datos personales sensibles en ninguno de los dos.*

- [ ] **Deshabilitar el botón de envío mientras hay una petición en curso.**
  - Deshabilitar el botón en cuanto el usuario envía el formulario y rehabilitarlo al recibir la respuesta.
  - *Previene el envío de peticiones duplicadas por doble clic o por intentos de manipulación.*

- [ ] **Validar los campos en el cliente antes de enviar la petición.**
  - Verificar que los campos obligatorios estén completos y con formato correcto.
  - *No reemplaza la validación del servidor, pero evita gastar una llamada al API con datos evidentemente inválidos.*
