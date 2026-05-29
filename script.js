// ⚠️ PEGA AQUÍ TU URL DE GOOGLE APPS SCRIPT
const GOOGLE_URL = "https://script.google.com/macros/s/AKfycbzWGnxPnf1z-oxw5fHIHZwZWHU0bSuQzIl9vZrvsb5d0QkM4WokxUHAn6pGAInUprq1NQ/exec";

// Tiempo de vida del token: 7 días en milisegundos (sincronizado con el servidor)
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Lee el token del localStorage. Devuelve "" si no existe o ya expiró.
 */
function obtenerToken(username) {
    const raw = localStorage.getItem('quiz_token_' + username);
    if (!raw) return "";
    try {
        const datos = JSON.parse(raw);
        if (Date.now() > datos.expira) {
            localStorage.removeItem('quiz_token_' + username);
            return "";
        }
        return datos.token;
    } catch {
        // Formato antiguo sin expiración: borrar y tratar como nuevo
        localStorage.removeItem('quiz_token_' + username);
        return "";
    }
}

/**
 * Guarda el token en localStorage junto con su fecha de expiración.
 */
function guardarToken(username, token) {
    const datos = {
        token: token,
        expira: Date.now() + TOKEN_TTL_MS
    };
    localStorage.setItem('quiz_token_' + username, JSON.stringify(datos));
}

// Esperar a que el documento cargue para asignar el evento al formulario
document.addEventListener("DOMContentLoaded", () => {
    const formulario = document.getElementById("formulario-quiz");

    formulario.addEventListener("submit", async function(evento) {
        // Esto evita que el navegador recargue la página al enviar el formulario
        evento.preventDefault();
        await enviarQuiz();
    });
});

async function enviarQuiz() {
    const btn = document.getElementById("btn-enviar");
    const msjError = document.getElementById("mensaje-error");
    const msjExito = document.getElementById("mensaje-exito");

    const username = document.getElementById("username").value.trim();
    const token = obtenerToken(username);

    // Recolectar datos
    const payload = {
        username: username,
        token: token,
        p1: document.getElementById("p1").value,
        p2: document.getElementById("p2").value,
        p3: document.getElementById("p3").value
    };

    // Preparar UI para el envío
    btn.innerText = "Evaluando en el servidor...";
    btn.disabled = true;
    msjError.style.display = "none";
    msjExito.style.display = "none";

    try {
        // Envío con POST como text/plain para evadir CORS
        const respuesta = await fetch(GOOGLE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        const resultado = await respuesta.json();

        if (resultado.estado === "error") {
            mostrarError(resultado.mensaje);
            btn.innerText = "Enviar Respuestas";
            btn.disabled = false;
        } else {
            // Guardar token si el servidor asignó uno nuevo
            if (resultado.token) {
                guardarToken(username, resultado.token);
            }

            // Mejora de seguridad: limpiar campos sensibles del DOM
            // antes de mostrar el leaderboard, por si hubiera algún XSS residual
            // Mantenemos el username para futuros intentos en la misma sesión, 
            // pero si prefieres, lo puedes limpiar con document.getElementById("username").value = "";

            // Éxito: Ocultar quiz y mostrar Leaderboard
            document.getElementById("quiz-container").style.display = "none";
            document.getElementById("leaderboard").style.display = "block";

            msjExito.textContent = "";
            const linea1 = document.createElement("span");
            linea1.textContent = `¡Examen evaluado! Obtuviste `;
            const negrita = document.createElement("strong");
            negrita.textContent = `${resultado.puntajeObtenido} de 3`;
            const linea2 = document.createTextNode(` puntos. Te quedan ${resultado.intentosRestantes} intentos.`);
            msjExito.appendChild(linea1);
            msjExito.appendChild(negrita);
            msjExito.appendChild(linea2);
            msjExito.style.display = "block";

            // Construir la tabla de forma segura con textContent
            // para evitar que nombres de usuario maliciosos se ejecuten como código
            const tbody = document.querySelector("#tabla-posiciones tbody");
            tbody.innerHTML = "";
            resultado.leaderboard.forEach(fila => {
                const fila_dom = document.createElement('tr');
                fila_dom.insertCell(0).textContent = fila.user;
                fila_dom.insertCell(1).textContent = `${fila.score} / 3`;
                tbody.appendChild(fila_dom);
            });
        }
    } catch (error) {
        mostrarError("Error de conexión con el servidor. Revisa tu consola para más detalles.");
        btn.innerText = "Enviar Respuestas";
        btn.disabled = false;
    }
}

function mostrarError(texto) {
    const msjError = document.getElementById("mensaje-error");
    msjError.innerText = texto;
    msjError.style.display = "block";
}

function reiniciarPantalla() {
    document.getElementById("quiz-container").style.display = "block";
    document.getElementById("leaderboard").style.display = "none";
    document.getElementById("mensaje-exito").style.display = "none";
    document.getElementById("btn-enviar").innerText = "Enviar Respuestas";
    document.getElementById("btn-enviar").disabled = false;

    // Limpiamos solo las opciones del quiz, mantenemos username cargado
    document.getElementById("p1").value = "A";
    document.getElementById("p2").value = "A";
    document.getElementById("p3").value = "A";

    // Hacemos scroll hacia arriba
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
