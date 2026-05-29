// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

/**
 * Lee el SALT global desde las Propiedades del Script.
 * Si no existe, genera uno aleatorio y lo guarda de forma persistente.
 */
function obtenerSalt() {
  var props = PropertiesService.getScriptProperties();
  var salt = props.getProperty("GLOBAL_SALT");
  if (!salt) {
    salt = Utilities.getUuid();
    props.setProperty("GLOBAL_SALT", salt);
  }
  return salt;
}

/**
 * Aplica un hash SHA-256 a un texto combinado con el SALT.
 */
function hashear(texto, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto + salt);
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/**
 * Previene la inyección de fórmulas maliciosas en Google Sheets.
 */
function sanitizarParaHoja(value) {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) {
    return "'" + value;
  }
  return value;
}

/**
 * Parsea, sanitiza y valida los datos crudos recibidos del cliente.
 * Lanza un error si algún campo es inválido.
 */
function parsearEntrada(params) {
  var usernameRequest = String(params.username).trim();
  if (!usernameRequest) throw new Error("Falta el nombre de usuario.");
  if (usernameRequest.length > 30) {
    throw new Error("El nombre de usuario no puede superar los 30 caracteres.");
  }
  if (!/^[a-zA-Z0-9_ áéíóúÁÉÍÓÚñÑüÜ]+$/.test(usernameRequest)) {
    throw new Error("El nombre de usuario contiene caracteres sospechosos o no permitidos.");
  }

  // Verificar existencia de cada respuesta antes de castear
  if (params.p1 === undefined || params.p2 === undefined || params.p3 === undefined) {
    throw new Error("Faltan una o más respuestas del quiz.");
  }
  var opcionesValidas = ["A", "B", "C"];
  var p1 = sanitizarParaHoja(String(params.p1).trim());
  var p2 = sanitizarParaHoja(String(params.p2).trim());
  var p3 = sanitizarParaHoja(String(params.p3).trim());
  if (![p1, p2, p3].every(function(r) { return opcionesValidas.indexOf(r) !== -1; })) {
    throw new Error("Las respuestas enviadas contienen valores no válidos.");
  }

  return {
    username: usernameRequest,
    token: params.token ? String(params.token).trim() : "",
    p1: p1,
    p2: p2,
    p3: p3
  };
}

/**
 * Verifica que el usuario no haya superado el límite de intentos fallidos.
 * Devuelve el número actual de intentos fallidos (o null si no hay ninguno).
 */
function verificarFuerzaBruta(cache, cacheKey) {
  var failedAttempts = cache.get(cacheKey);
  if (failedAttempts && parseInt(failedAttempts, 10) >= 5) {
    throw new Error("Demasiados intentos fallidos. Por seguridad, espera 15 minutos antes de volver a intentarlo.");
  }
  return failedAttempts;
}

/**
 * Busca el usuario en la hoja y valida su token.
 * Devuelve un objeto con { isNewUser, userRowIndex, usernameFinal }.
 * Lanza un error si el token no coincide (nombre de usuario tomado).
 */
function autenticarUsuario(dataUsuarios, usernameRequest, tokenRequest, tokenHashRecibido, cache, cacheKey, failedAttempts) {
  for (var i = 1; i < dataUsuarios.length; i++) {
    var rowUsername = String(dataUsuarios[i][0]).toLowerCase();

    if (rowUsername === usernameRequest.toLowerCase()) {
      var storedTokenHash = String(dataUsuarios[i][1]);

      if (!tokenRequest || storedTokenHash !== tokenHashRecibido) {
        var currentAttempts = failedAttempts ? parseInt(failedAttempts, 10) : 0;
        cache.put(cacheKey, (currentAttempts + 1).toString(), 900); // 900 seg = 15 minutos
        throw new Error("Este nombre de usuario ya está tomado. Si eres tú, usa tu dispositivo original o elige otro nombre.");
      }

      cache.remove(cacheKey); // Login exitoso: reiniciar contador de fuerza bruta
      return {
        isNewUser: false,
        userRowIndex: i + 1, // +1 porque los arrays empiezan en 0 y las filas en 1
        usernameFinal: dataUsuarios[i][0],
        tokenFecha: dataUsuarios[i][4] || null // Columna 5: fecha de creación del token
      };
    }
  }

  // No se encontró el username: es un usuario nuevo
  return {
    isNewUser: true,
    userRowIndex: -1,
    usernameFinal: usernameRequest
  };
}

/**
 * Evalúa las respuestas del quiz. Las respuestas correctas nunca salen de aquí.
 * Cualquier inyección enviada en p1/p2/p3 simplemente cuenta como incorrecta.
 */
function evaluarRespuestas(p1, p2, p3) {
  var correctas = { p1: "B", p2: "A", p3: "C" };
  var puntaje = 0;
  if (p1 === correctas.p1) puntaje++;
  if (p2 === correctas.p2) puntaje++;
  if (p3 === correctas.p3) puntaje++;
  return puntaje;
}

var LEADERBOARD_CACHE_KEY = "leaderboard_top10";
var LEADERBOARD_CACHE_TTL = 60; // segundos

/**
 * Devuelve el Top 10 del leaderboard.
 * Usa caché de 60 segundos para evitar leer la hoja en cada petición.
 * Llama a invalidarCacheLeaderboard(cache) después de escribir en la hoja.
 */
function construirLeaderboard(sheetUsuarios, cache) {
  var cached = cache.get(LEADERBOARD_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var updatedUsers = sheetUsuarios.getDataRange().getValues();
  var leaderboard = [];
  for (var j = 1; j < updatedUsers.length; j++) {
    leaderboard.push({
      user: String(updatedUsers[j][0]),
      score: parseInt(updatedUsers[j][3], 10) || 0
    });
  }
  leaderboard.sort(function(a, b) { return b.score - a.score; });
  leaderboard = leaderboard.slice(0, 10);

  cache.put(LEADERBOARD_CACHE_KEY, JSON.stringify(leaderboard), LEADERBOARD_CACHE_TTL);
  return leaderboard;
}

/**
 * Invalida el caché del leaderboard para que la siguiente petición lo reconstruya.
 * Llamar siempre después de escribir datos en la hoja de Usuarios.
 */
function invalidarCacheLeaderboard(cache) {
  cache.remove(LEADERBOARD_CACHE_KEY);
}


// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Intentar adquirir el bloqueo por hasta 10 segundos para evitar condiciones de carrera
  if (!lock.tryLock(10000)) {
    return ContentService.createTextOutput(JSON.stringify({
      estado: "error",
      mensaje: "El sistema está ocupado procesando otro registro. Por favor, intenta de nuevo en unos segundos."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var SALT  = obtenerSalt();
    var input = parsearEntrada(JSON.parse(e.postData.contents));

    var cache          = CacheService.getScriptCache();
    var cacheKey       = "bruteforce_" + input.username.toLowerCase();
    var failedAttempts = verificarFuerzaBruta(cache, cacheKey);

    var tokenHashRecibido = input.token ? hashear(input.token, SALT) : "";

    var libro           = SpreadsheetApp.getActiveSpreadsheet();
    var sheetUsuarios   = libro.getSheetByName("Usuarios");
    var sheetResultados = libro.getSheetByName("Resultados");
    var dataUsuarios    = sheetUsuarios.getDataRange().getValues();

    var auth = autenticarUsuario(dataUsuarios, input.username, input.token, tokenHashRecibido, cache, cacheKey, failedAttempts);

    var SIETE_DIAS_MS    = 7 * 24 * 60 * 60 * 1000;
    var intentosRestantes = 3;
    var mejorPuntaje      = 0;
    var newTokenToReturn  = null;
    var finalTokenHash    = tokenHashRecibido;
    var tokenRenovado     = false;

    if (!auth.isNewUser) {
      intentosRestantes = parseInt(dataUsuarios[auth.userRowIndex - 1][2], 10);
      mejorPuntaje      = parseInt(dataUsuarios[auth.userRowIndex - 1][3], 10) || 0;
      if (intentosRestantes <= 0) {
        throw new Error("Ya has agotado tus 3 intentos permitidos.");
      }
      // Renovar token si han pasado más de 7 días desde su creación
      var fechaToken = auth.tokenFecha ? new Date(auth.tokenFecha) : null;
      if (!fechaToken || (new Date() - fechaToken) > SIETE_DIAS_MS) {
        newTokenToReturn = Utilities.getUuid();
        finalTokenHash   = hashear(newTokenToReturn, SALT);
        tokenRenovado    = true;
      }
    } else {
      // Usuario nuevo: generamos y hasheamos su token único
      newTokenToReturn = Utilities.getUuid();
      finalTokenHash   = hashear(newTokenToReturn, SALT);
    }

    var puntaje = evaluarRespuestas(input.p1, input.p2, input.p3);
    intentosRestantes--;
    if (puntaje > mejorPuntaje) mejorPuntaje = puntaje;

    // Guardar en la hoja de Usuarios (estructura: Username, TokenHash, Intentos, MejorPuntaje, FechaToken)
    if (auth.isNewUser) {
      sheetUsuarios.appendRow([auth.usernameFinal, finalTokenHash, intentosRestantes, mejorPuntaje, new Date()]);
    } else {
      sheetUsuarios.getRange(auth.userRowIndex, 3).setValue(intentosRestantes);
      sheetUsuarios.getRange(auth.userRowIndex, 4).setValue(mejorPuntaje);
      if (tokenRenovado) {
        // Actualizar hash y fecha al renovar el token
        sheetUsuarios.getRange(auth.userRowIndex, 2).setValue(finalTokenHash);
        sheetUsuarios.getRange(auth.userRowIndex, 5).setValue(new Date());
      }
    }

    // Guardar el registro de este intento en la hoja de Resultados
    sheetResultados.appendRow([new Date(), auth.usernameFinal, input.p1, input.p2, input.p3, puntaje]);

    // Invalidar el caché del leaderboard porque los datos de la hoja cambiaron
    invalidarCacheLeaderboard(cache);

    var jsonResponse = {
      estado: "exito",
      puntajeObtenido: puntaje,
      intentosRestantes: intentosRestantes,
      leaderboard: construirLeaderboard(sheetUsuarios, cache)
    };

    // Solo incluimos el token en la respuesta si fue recién generado
    if (newTokenToReturn) jsonResponse.token = newTokenToReturn;

    return ContentService.createTextOutput(JSON.stringify(jsonResponse)).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      estado: "error",
      mensaje: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    // Siempre liberar el bloqueo para la siguiente petición
    lock.releaseLock();
  }
}
