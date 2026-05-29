// ⚠️ PEGA AQUÍ TU URL DE GOOGLE APPS SCRIPT
const GOOGLE_URL = "https://script.google.com/macros/s/AKfycbzWGnxPnf1z-oxw5fHIHZwZWHU0bSuQzIl9vZrvsb5d0QkM4WokxUHAn6pGAInUprq1NQ/exec";

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
    const token = localStorage.getItem('quiz_token_' + username) || "";

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
                localStorage.setItem('quiz_token_' + username, resultado.token);
            }

            // Mejora de seguridad: limpiar campos sensibles del DOM
            // antes de mostrar el leaderboard, por si hubiera algún XSS residual
            // Mantenemos el username para futuros intentos en la misma sesión, 
            // pero si prefieres, lo puedes limpiar con document.getElementById("username").value = "";

            // Éxito: Ocultar quiz y mostrar Leaderboard
            document.getElementById("quiz-container").style.display = "none";
            document.getElementById("leaderboard").style.display = "block";

            msjExito.innerHTML = `¡Examen evaluado! Obtuviste <strong>${resultado.puntajeObtenido} de 3</strong> puntos.<br>Te quedan ${resultado.intentosRestantes} intentos.`;
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
