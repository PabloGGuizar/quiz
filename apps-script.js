function doPost(e) {
  var lock = LockService.getScriptLock();
  // Intentar adquirir el bloqueo por hasta 10 segundos
  if (!lock.tryLock(10000)) {
    return ContentService.createTextOutput(JSON.stringify({
      estado: "error",
      mensaje: "El sistema está ocupado procesando otro registro. Por favor, intenta de nuevo en unos segundos."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    // 1. Parsear los datos recibidos y sanitizarlos (Prevenir inyección)
    var params = JSON.parse(e.postData.contents);
    var email = String(params.email).trim().toLowerCase();
    var password = String(params.password).trim();
    var usernameRequest = String(params.username).trim();
    
    // Función para evitar inyección de fórmulas en Google Sheets
    function sanitizeForSheet(value) {
      if (typeof value === "string" && /^[=+\-@]/.test(value)) {
        return "'" + value;
      }
      return value;
    }

    var p1 = sanitizeForSheet(String(params.p1).trim());
    var p2 = sanitizeForSheet(String(params.p2).trim());
    var p3 = sanitizeForSheet(String(params.p3).trim());

    if (!email || !password) throw new Error("Faltan el correo o la contraseña.");
    
    // Validar formato de correo para prevenir inyecciones y errores
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Formato de correo electrónico inválido.");
    }

    // Prevención de ataques de fuerza bruta usando Cache
    var cache = CacheService.getScriptCache();
    var cacheKey = "bruteforce_" + email;
    var failedAttempts = cache.get(cacheKey);
    if (failedAttempts && parseInt(failedAttempts) >= 5) {
      throw new Error("Demasiados intentos fallidos. Por seguridad, espera 15 minutos antes de volver a intentarlo.");
    }

    // Encriptar la contraseña usando SHA-256
    var hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
    var hashedPassword = hashBytes.map(function(b) {
        return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');

    if (usernameRequest && !/^[a-zA-Z0-9_ áéíóúÁÉÍÓÚñÑüÜ]+$/.test(usernameRequest)) {
      throw new Error("El nombre de usuario contiene caracteres sospechosos o no permitidos.");
    }

    var libro = SpreadsheetApp.getActiveSpreadsheet();
    var sheetUsuarios = libro.getSheetByName("Usuarios");
    var sheetResultados = libro.getSheetByName("Resultados");
    var dataUsuarios = sheetUsuarios.getDataRange().getValues();

    var userRowIndex = -1;
    var isNewUser = true;
    var usernameFinal = usernameRequest;

    // 2. Lógica de Autenticación y Validación de Usuario
    for (var i = 1; i < dataUsuarios.length; i++) {
      var rowEmail = String(dataUsuarios[i][1]).toLowerCase();
      var rowUsername = String(dataUsuarios[i][0]).toLowerCase();
      
      // Si el correo ya existe, es un usuario recurrente
      if (rowEmail === email) {
        userRowIndex = i + 1; // +1 porque los arreglos empiezan en 0 y las filas en 1
        isNewUser = false;
        
        // Validar contraseña comparando los hashes
        if (String(dataUsuarios[i][2]) !== hashedPassword) {
          var currentAttempts = failedAttempts ? parseInt(failedAttempts) : 0;
          cache.put(cacheKey, (currentAttempts + 1).toString(), 900); // 900 seg = 15 minutos
          throw new Error("Credenciales inválidas o el nombre de usuario no está disponible.");
        } else {
          // Si el login es exitoso, reiniciar intentos
          cache.remove(cacheKey);
        }
        
        // Forzamos a usar el username que ya tiene registrado
        usernameFinal = dataUsuarios[i][0]; 
        break;
      }
      
      // Si el correo no existe, pero el nombre de usuario que intenta registrar ya está tomado
      if (isNewUser && rowUsername === usernameRequest.toLowerCase()) {
        throw new Error("Credenciales inválidas o el nombre de usuario no está disponible.");
      }
    }

    var intentosRestantes = 3;
    var mejorPuntaje = 0;

    // 3. Control de Intentos
    if (!isNewUser) {
      intentosRestantes = parseInt(dataUsuarios[userRowIndex - 1][3]);
      mejorPuntaje = parseInt(dataUsuarios[userRowIndex - 1][4]) || 0;
      if (intentosRestantes <= 0) {
        throw new Error("Ya has agotado tus 3 intentos permitados.");
      }
    } else {
      if (!usernameRequest) throw new Error("Debes elegir un nombre de usuario para tu primer intento.");
    }

    // 4. Evaluación Segura (Las respuestas correctas nunca salen de aquí)
    var correctas = { p1: "B", p2: "A", p3: "C" };
    var puntaje = 0;
    
    // Solo sumamos si la respuesta enviada coincide exactamente. 
    // Cualquier inyección de SQL o JS enviada en p1/p2/p3 simplemente se evalúa como incorrecta.
    if (p1 === correctas.p1) puntaje++;
    if (p2 === correctas.p2) puntaje++;
    if (p3 === correctas.p3) puntaje++;

    intentosRestantes--;
    if (puntaje > mejorPuntaje) mejorPuntaje = puntaje;

    // 5. Guardar Datos en Hojas
    if (isNewUser) {
      // Nuevo usuario
      sheetUsuarios.appendRow([usernameFinal, email, hashedPassword, intentosRestantes, mejorPuntaje]);
    } else {
      // Actualizar usuario existente
      sheetUsuarios.getRange(userRowIndex, 4).setValue(intentosRestantes);
      sheetUsuarios.getRange(userRowIndex, 5).setValue(mejorPuntaje);
    }

    // Guardar el registro de este intento
    sheetResultados.appendRow([new Date(), usernameFinal, p1, p2, p3, puntaje]);

    // 6. Generar el Tablero de Posiciones (Leaderboard seguro)
    // Volvemos a leer los datos actualizados
    var updatedUsers = sheetUsuarios.getDataRange().getValues();
    var leaderboard = [];
    for (var j = 1; j < updatedUsers.length; j++) {
      leaderboard.push({
        user: String(updatedUsers[j][0]),
        score: parseInt(updatedUsers[j][4]) || 0
      });
    }
    
    // Ordenar de mayor a menor puntaje
    leaderboard.sort(function(a, b) { return b.score - a.score; });
    // Tomar solo el Top 10
    leaderboard = leaderboard.slice(0, 10);

    // 7. Enviar respuesta al Frontend
    return ContentService.createTextOutput(JSON.stringify({
      estado: "exito",
      puntajeObtenido: puntaje,
      intentosRestantes: intentosRestantes,
      leaderboard: leaderboard
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Si arrojamos un error arriba, lo mandamos a la app
    return ContentService.createTextOutput(JSON.stringify({
      estado: "error",
      mensaje: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    // Siempre liberar el bloqueo para la siguiente petición
    lock.releaseLock();
  }
}
