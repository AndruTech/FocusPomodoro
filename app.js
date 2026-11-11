// --- 1. ESTADO DE LA APLICACIÓN ---
let state = {
  workTime: 5, // 5 segundos para pruebas
  breakTime: 5, // 5 segundos para pruebas
  longBreakTime: 5, // 5 segundos para pruebas
  currentTime: 5,
  timerId: null,
  isRunning: false,
  mode: "work", // 'work', 'shortBreak', 'longBreak'
  isTransitioning: false, // Bandera para la cuenta regresiva de transición

  completedToday: 0,
  pomodoroCycleCount: 0,
  streak: parseInt(localStorage.getItem("focus_streak")) || 0,
  dailyGoal: 4,
  session: parseInt(localStorage.getItem("session_counter") || 1),

  // ✅ Separamos los contadores en el estado para corto y largo
  shortBreakCounter: parseInt(localStorage.getItem("short_break_counter")) || 0,
  longBreakCounter: parseInt(localStorage.getItem("long_break_counter")) || 0,

  isChestReady: false, // 👈 Nuevo: Indica si el cofre tiene premio pendiente
};

// --- 2. SELECCIÓN DE ELEMENTOS DEL DOM ---
const timerDisplay = document.getElementById("timer-display");
const btnStart = document.getElementById("btn-start");
const btnWork = document.getElementById("btn-work");
const btnShortBreak = document.getElementById("btn-short-break");
const btnLongBreak = document.getElementById("btn-long-break");
const sessionCounter = document.getElementById("session-counter");

// ✅ Referencias independientes para cada span de descanso en el HTML
const shortBreakCount = document.getElementById("short-break-counter");
const longBreakCount = document.getElementById("long-break-counter");

const streakCounter = document.getElementById("streak-counter");
const pomodoroCount = document.getElementById("pomodoro-count");
const progressCircle = document.getElementById("progress-circle");
const sessionStatus = document.getElementById("session-status");

const CIRCUMFERENCE = 2 * Math.PI * 42;

// Al inicio de tu archivo o junto con las otras funciones de actualización visual:
const iconContainer = document.getElementById("chest-icon-container");
if (iconContainer) {
  iconContainer.innerHTML =
    '<i class="fi fi-rs-treasure-chest text-slate-400"></i>';
}

updateStreakDisplay();
updateProgressDisplay();
updateSessionDisplay();
updateBreakCountersDisplay();
updateDisplay();

// --- 3. FUNCIONES DE FORMATO Y VISTA ---
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function updateDisplay() {
  if (!state.isTransitioning) {
    timerDisplay.textContent = formatTime(state.currentTime);
  }
  updateCircleProgress();
}

function updateCircleProgress() {
  let totalTime = state.workTime;
  if (state.mode === "shortBreak") totalTime = state.breakTime;
  if (state.mode === "longBreak") totalTime = state.longBreakTime;

  const timePassed = totalTime - state.currentTime;
  const progressFraction = Math.min(1, Math.max(0, timePassed / totalTime));

  const offset = CIRCUMFERENCE * progressFraction;
  if (progressCircle) {
    progressCircle.style.strokeDashoffset = offset;
  }
}

function updateStreakDisplay() {
  if (streakCounter) streakCounter.textContent = state.streak;
  localStorage.setItem("focus_streak", state.streak);
}

function updateSessionDisplay() {
  if (sessionCounter) {
    sessionCounter.textContent = state.session;
  }
  localStorage.setItem("session_counter", state.session);
}

function updateBreakCountersDisplay() {
  // ✅ Actualizamos ambos contadores de forma independiente en pantalla y localStorage
  if (shortBreakCount) {
    shortBreakCount.textContent = state.shortBreakCounter;
  }
  localStorage.setItem("short_break_counter", state.shortBreakCounter);

  if (longBreakCount) {
    longBreakCount.textContent = state.longBreakCounter;
  }
  localStorage.setItem("long_break_counter", state.longBreakCounter);
}

function updateProgressDisplay() {
  if (pomodoroCount)
    pomodoroCount.textContent = `${state.completedToday}/${state.dailyGoal}`;
}

// --- 4. LÓGICA DEL TEMPORIZADOR Y TRANSICIÓN DE 3 SEGUNDOS ---
function startTimer() {
  if (state.isRunning) {
    clearInterval(state.timerId);
    state.isRunning = false;
    btnStart.textContent = "Start";
    btnStart.className =
      "px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/40 transition-all transform active:scale-95";
    return;
  }

  unlockAudioContext();

  state.isRunning = true;
  btnStart.textContent = "Pause";
  btnStart.className =
    "px-8 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-amber-600/40 transition-all transform active:scale-95";

  state.timerId = setInterval(() => {
    if (state.currentTime > 0) {
      state.currentTime--;
      updateDisplay();
    } else {
      // ¡TIEMPO CUMPLIDO!
      clearInterval(state.timerId);
      state.isRunning = false;

      playSoftChime();

      if (state.mode === "work") {
        state.completedToday++;
        state.pomodoroCycleCount++;
        state.session++;
        state.isChestReady = true;

        const iconContainer = document.getElementById("chest-icon-container");
        if (iconContainer) {
          iconContainer.innerHTML =
            '<i class="fi fi-rs-treasure-chest text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-bounce"></i>';
        }

        if (chestDot) chestDot.classList.remove("hidden");

        // 🔊 ¡Reproducir sonido triunfal de cofre desbloqueado!
        playChestUnlockSound();

        updateSessionDisplay();
        updateProgressDisplay();

        if (state.completedToday === state.dailyGoal) {
          state.streak++;
          updateStreakDisplay();
        }

        // Determinar si toca Short Break o Long Break (cada 4 pomodoros)
        let nextMode =
          state.pomodoroCycleCount % 4 === 0 ? "longBreak" : "shortBreak";

        runTransitionCountdown("¡Pomodoro completado! 🎯", nextMode);
      } else {
        // ✅ Evaluamos cuál descanso terminó exactamente ANTES de volver a work
        if (state.mode === "shortBreak") {
          state.shortBreakCounter++;
        } else if (state.mode === "longBreak") {
          state.longBreakCounter++;
        }

        updateBreakCountersDisplay();
        runTransitionCountdown("¡Descanso terminado! ⚡", "work");
      }
    }
  }, 1000);
}

// --- 5. CUENTA REGRESIVA DE TRANSICIÓN EN PANTALLA ---
function runTransitionCountdown(message, targetMode) {
  state.isTransitioning = true;
  let countdown = 3;

  if (sessionStatus) {
    sessionStatus.textContent = message;
  }

  if (timerDisplay) {
    timerDisplay.textContent = countdown;
  }

  updateCircleColor(targetMode);

  let transitionInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      if (timerDisplay) {
        timerDisplay.textContent = countdown;
      }
    } else {
      clearInterval(transitionInterval);
      state.isTransitioning = false;

      switchModeWithoutReset(targetMode);
      startTimer();
    }
  }, 1000);
}

function updateCircleColor(mode) {
  if (progressCircle) {
    progressCircle.classList.remove(
      "stroke-purple-500",
      "stroke-emerald-400",
      "stroke-cyan-400",
    );
    if (mode === "work") {
      progressCircle.classList.add("stroke-purple-500");
    } else if (mode === "shortBreak") {
      progressCircle.classList.add("stroke-emerald-400");
    } else if (mode === "longBreak") {
      progressCircle.classList.add("stroke-cyan-400");
    }
  }
}

function switchModeWithoutReset(mode) {
  state.mode = mode;
  if (mode === "work") {
    state.currentTime = state.workTime;
    if (sessionStatus) sessionStatus.textContent = "Focus session ⚡";
  } else if (mode === "shortBreak") {
    state.currentTime = state.breakTime;
    if (sessionStatus) sessionStatus.textContent = "Short Break ☕";
  } else if (mode === "longBreak") {
    state.currentTime = state.longBreakTime;
    if (sessionStatus) sessionStatus.textContent = "Long Break 🌴";
  }

  updateCircleColor(mode);

  if (btnWork)
    btnWork.className =
      "px-5 py-1.5 text-xs font-semibold rounded-full text-slate-400 hover:text-white transition-all";
  if (btnShortBreak)
    btnShortBreak.className =
      "px-5 py-1.5 text-xs font-semibold rounded-full text-slate-400 hover:text-white transition-all";
  if (btnLongBreak)
    btnLongBreak.className =
      "px-5 py-1.5 text-xs font-semibold rounded-full text-slate-400 hover:text-white transition-all";

  if (mode === "work" && btnWork)
    btnWork.className =
      "px-5 py-1.5 text-xs font-semibold rounded-full bg-indigo-600 text-white transition-all shadow-sm";
  if (mode === "shortBreak" && btnShortBreak)
    btnShortBreak.className =
      "px-5 py-1.5 text-xs font-semibold rounded-full bg-emerald-600 text-white transition-all shadow-sm";
  if (mode === "longBreak" && btnLongBreak)
    btnLongBreak.className =
      "px-5 py-1.5 text-xs font-semibold rounded-full bg-cyan-600 text-white transition-all shadow-sm";

  updateDisplay();
}

function switchMode(mode) {
  clearInterval(state.timerId);
  state.isRunning = false;
  state.isTransitioning = false;
  state.mode = mode;

  if (mode === "work") state.currentTime = state.workTime;
  if (mode === "shortBreak") state.currentTime = state.breakTime;
  if (mode === "longBreak") state.currentTime = state.longBreakTime;

  switchModeWithoutReset(mode);

  btnStart.textContent = "Start";
  btnStart.className =
    "px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/40 transition-all transform active:scale-95";
}

// --- 8. EFECTO DE AUDIO (WEB AUDIO API) ---
let audioCtx = null;

function unlockAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playSoftChime() {
  try {
    unlockAudioContext();
    if (!audioCtx) return;

    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(887.33, audioCtx.currentTime);

        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioCtx.currentTime + 0.6,
        );

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
      }, i * 250);
    }
  } catch (e) {
    console.log("Error al reproducir audio:", e);
  }
} // --- Themes ---

// --- CONFIGURACIÓN DE TEMAS ---
const themesConfig = {
  nature: "./Themes/nature1.jpg",
  sunset:
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80",
  minimal: "solid", // Indicador para color sólido
};

function setTheme(themeName) {
  state.currentTheme = themeName;
  localStorage.setItem("pomodoro_theme", themeName);

  const bgImage = document.getElementById("bg-image");

  if (themesConfig[themeName] === "solid") {
    // Si es minimal, ocultamos la imagen de fondo y dejamos el color sólido del body
    if (bgImage) bgImage.style.opacity = "0";
    document.body.style.backgroundColor = "#020617"; // Slate 950
  } else {
    // Si es un tema con imagen, actualizamos el src y mostramos la imagen
    if (bgImage) {
      bgImage.src = themesConfig[themeName];
      bgImage.style.opacity = "2";
    }
  }
}

// Función para mostrar u ocultar el menú flotante
const btnThemeToggle = document.getElementById("btn-theme-toggle");
const themeMenu = document.getElementById("theme-menu");

function toggleThemeMenu() {
  if (themeMenu) {
    themeMenu.classList.toggle("hidden");
  }
}

if (btnThemeToggle) {
  btnThemeToggle.addEventListener("click", (e) => {
    e.stopPropagation(); // Evita que el clic cierre el menú inmediatamente
    toggleThemeMenu();
  });
}

// Cerrar el menú si se hace clic en cualquier otra parte de la pantalla
document.addEventListener("click", (e) => {
  if (
    themeMenu &&
    !themeMenu.contains(e.target) &&
    e.target !== btnThemeToggle
  ) {
    themeMenu.classList.add("hidden");
  }
});

// Cargar el tema guardado al iniciar la app (si existe en localStorage)
state.currentTheme = localStorage.getItem("pomodoro_theme") || "minimal";
setTheme(state.currentTheme);

// --- Cargar y cambiar frases motivacionales ---

// --- 11. SISTEMA DE FRASES MOTIVACIONALES DINÁMICAS ---
const motivationalQuotes = [
  '"Either you run the day or the day runs you."',
  '"Code, coffee, and consistency. ☕💻"',
  '"Small progress each day adds up to big results."',
  '"Focus is a muscle. The more you train it, the stronger it gets."',
  '"Build things that matter, one Pomodoro at a time."',
  '"Simplicity is the ultimate sophistication. - Leonardo da Vinci"',
  '"Don\'t watch the clock; do what it does. Keep going."',
  '"The secret of getting ahead is getting started."',
];

function rotateQuote() {
  const quoteElement = document.getElementById("quote-display");
  if (!quoteElement) return;

  // Efecto visual de desvanecimiento suave (Fade out)
  quoteElement.style.opacity = "0";

  setTimeout(() => {
    // Escoger una frase aleatoria que sea diferente a la actual si es posible
    let randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
    quoteElement.textContent = motivationalQuotes[randomIndex];

    // Restaurar la opacidad (Fade in)
    quoteElement.style.opacity = "1";
  }, 300); // 300ms coincide con la transición visual
}

// Cambiar de frase automáticamente cada 10 segundos (10000 milisegundos)
setInterval(rotateQuote, 10000);

// --- 12. GAMIFICACIÓN: SISTEMA DE RANGOS DE ENFOQUE ---
const userRankBadge = document.getElementById("user-rank-badge");

const ranks = [
  {
    minDays: 0,
    title: "🌱 Aprendiz",
    color: "border-slate-500 text-slate-300",
  },
  {
    minDays: 3,
    title: "⚡ Desarrollador Constante",
    color: "border-blue-500 text-blue-300",
  },
  {
    minDays: 7,
    title: "🔥 Modo Enfoque Extremo",
    color: "border-amber-500 text-amber-300",
  },
  {
    minDays: 15,
    title: "👑 Maestro del Código",
    color: "border-purple-500 text-purple-300",
  },
];

function updateRankDisplay() {
  if (!userRankBadge) return;

  // Determinar cuál rango le corresponde según su racha actual
  let currentRank = ranks[0];
  for (let i = ranks.length - 1; i >= 0; i--) {
    if (state.streak >= ranks[i].minDays) {
      currentRank = ranks[i];
      break;
    }
  }

  // Actualizar el texto del tooltip
  userRankBadge.textContent = currentRank.title;
}

// Sobrescribimos la función original updateStreakDisplay para que refresque también el rango
const originalUpdateStreakDisplay = updateStreakDisplay;
updateStreakDisplay = function () {
  if (streakCounter) streakCounter.textContent = state.streak;
  localStorage.setItem("focus_streak", state.streak);
  updateRankDisplay(); // Refresca el rango visual
};

// Inicializar rango al cargar la aplicación
updateRankDisplay();

// --- 13. GAMIFICACIÓN: PROGRESO DE TAREAS Y ESTADO OVERDRIVE ---
const pomodoroCountElement = document.getElementById("pomodoro-count");

// Sobrescribimos la función updateProgressDisplay para añadir animación y efectos visuales
const originalUpdateProgressDisplay = updateProgressDisplay;
updateProgressDisplay = function () {
  if (pomodoroCountElement) {
    pomodoroCountElement.textContent = `${state.completedToday}/${state.dailyGoal}`;

    // Efecto de rebote (micro-animación) al sumar un pomodoro
    pomodoroCountElement.classList.add("scale-125");
    setTimeout(() => {
      pomodoroCountElement.classList.remove("scale-125");
    }, 300);

    // Estado Overdrive / Meta Diaria Alcanzada
    if (state.completedToday >= state.dailyGoal) {
      pomodoroCountElement.className =
        "text-[10px] bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 rounded-full text-amber-300 font-bold animate-pulse transition-all duration-300 inline-block shadow-[0_0_10px_rgba(245,158,11,0.4)]";
    } else {
      pomodoroCountElement.className =
        "text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-indigo-400 font-bold transition-all duration-300 inline-block";
    }
  }

  // Guardar progreso diario en localStorage si es necesario
  localStorage.setItem("completed_today", state.completedToday);
};

// Cargar completedToday guardado al iniciar (opcional pero recomendado)
state.completedToday = parseInt(localStorage.getItem("completed_today")) || 0;
updateProgressDisplay();

// --- 14. GAMIFICACIÓN: COFRE DE RECOMPENSAS (LOOT BOX) ---
const btnChest = document.getElementById("btn-chest");
const chestModal = document.getElementById("chest-modal");
const btnCloseChest = document.getElementById("btn-close-chest");
const chestRewardText = document.getElementById("chest-reward-text");
const chestDot = document.getElementById("chest-dot");

// Lista de recompensas épicas que pueden salir en el cofre
const chestRewards = [
  "✨ Insignia desbloqueada: 'Café & Código' (Tu nivel de cafeína y concentración están sincronizados).",
  "💡 Sabiduría Indie: 'Haz que funcione, haz que sea correcto, haz que sea rápido... en ese orden.'",
  "🧘 Pausa Activa: Levántate, estira los brazos por 60 segundos y relaja la vista mirando a lo lejos.",
  "🚀 Bonus de Dopamina: ¡Tu próximo commit en GitHub va a compilar a la primera sin errores!",
  "☕ Ritual recomendado: Es un buen momento para recargar agua o café fresco antes del siguiente bloque.",
  "🎯 Micro-logro: Has demostrado más disciplina hoy que el 80% de las personas. ¡Sigue así!",
];

// Abrir el cofre al hacer clic
// Abrir el cofre al hacer clic
if (btnChest) {
  btnChest.addEventListener("click", () => {
    // Si el cofre NO está listo, no hacemos nada (o podríamos avisar que falta completar ciclos)
    if (!state.isChestReady) {
      // Opcional: un pequeño feedback visual de que está locked (bloqueado)
      return;
    }

    // 1. Cambiar el icono a cofre abierto / loot box dorado
    const iconContainer = document.getElementById("chest-icon-container");
    if (iconContainer) {
      iconContainer.innerHTML =
        '<i class="fi fi-bs-loot-box text-amber-400 scale-125 transition-transform duration-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]"></i>';
    }

    // 2. Escoger recompensa aleatoria
    const randomReward =
      chestRewards[Math.floor(Math.random() * chestRewards.length)];
    if (chestRewardText) {
      chestRewardText.textContent = randomReward;
    }

    // 3. Mostrar el modal
    if (chestModal) {
      chestModal.classList.remove("hidden");
    }

    // 4. Ocultar el punto de notificación
    if (chestDot) {
      chestDot.classList.add("hidden");
    }
  });
}

// Cerrar el modal del cofre
if (btnCloseChest) {
  btnCloseChest.addEventListener("click", () => {
    if (chestModal) {
      chestModal.classList.add("hidden");
    }

    // Restablecer el estado del cofre
    state.isChestReady = false;

    // Volver a poner el icono en BLANCO / apagado (sin clases doradas)
    const iconContainer = document.getElementById("chest-icon-container");
    if (iconContainer) {
      iconContainer.innerHTML =
        '<i class="fi fi-rs-treasure-chest text-slate-400 hover:text-slate-200 transition-colors"></i>';
    }
  });
}

// Cada vez que se completa un pomodoro de trabajo, notificamos que hay un regalo listo
const originalStartTimerForChest = startTimer;
// Aprovechamos que cuando state.mode === 'work' y termina el tiempo, activamos el cofre

// --- 15. SISTEMA DE TAREAS (TO-DO LIST) CON PERSISTENCIA ---
const btnTasksToggle = document.getElementById("btn-tasks-toggle");
const tasksModal = document.getElementById("tasks-modal");
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const tasksList = document.getElementById("tasks-list");
const tasksCompletedBadge = document.getElementById("tasks-completed-badge");

// Recuperar tareas guardadas o iniciar arreglo vacío
let tasks = JSON.parse(localStorage.getItem("pomodoro_tasks")) || [];

function saveTasks() {
  localStorage.setItem("pomodoro_tasks", JSON.stringify(tasks));
  renderTasks();
}

function renderTasks() {
  if (!tasksList) return;
  tasksList.innerHTML = "";

  if (tasks.length === 0) {
    tasksList.innerHTML = `
      <li class="text-[11px] text-slate-500 text-center py-4 italic">
        No hay tareas aún. ¡Añade tu primer objetivo del día!
      </li>
    `;
    if (tasksCompletedBadge) tasksCompletedBadge.textContent = "0 hechas";
    return;
  }

  let completedCount = 0;

  tasks.forEach((task, index) => {
    if (task.completed) completedCount++;

    const li = document.createElement("li");
    li.className = `flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
      task.completed
        ? "bg-slate-950/40 border-slate-800/50 text-slate-500 line-through"
        : "bg-slate-800/50 border-slate-700/40 text-white hover:border-slate-600"
    }`;

    li.innerHTML = `
      <div class="flex items-center gap-2 flex-1 min-w-0 pr-2">
        <input
          type="checkbox"
          ${task.completed ? "checked" : ""}
          onchange="toggleTask(${index})"
          class="w-3.5 h-3.5 accent-indigo-500 cursor-pointer rounded"
        />
        <span class="truncate cursor-pointer" onclick="toggleTask(${index})">${task.text}</span>
      </div>
      <button
        onclick="deleteTask(${index})"
        class="text-slate-500 hover:text-rose-400 transition text-xs px-1"
        title="Eliminar tarea"
      >
        ✕
      </button>
    `;

    tasksList.appendChild(li);
  });

  if (tasksCompletedBadge) {
    tasksCompletedBadge.textContent = `${completedCount} de ${tasks.length}`;
  }
}

function addTask(text) {
  if (!text.trim()) return;
  tasks.push({ text: text.trim(), completed: false });
  saveTasks();
}

function toggleTask(index) {
  if (tasks[index]) {
    tasks[index].completed = !tasks[index].completed;
    saveTasks();
  }
}

function deleteTask(index) {
  tasks.splice(index, 1);
  saveTasks();
}

// Event Listeners para el panel de tareas
if (btnTasksToggle) {
  btnTasksToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (tasksModal) tasksModal.classList.toggle("hidden");
  });
}

if (taskForm) {
  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (taskInput && taskInput.value) {
      addTask(taskInput.value);
      taskInput.value = "";
    }
  });
}

// Cerrar el modal al hacer clic fuera
document.addEventListener("click", (e) => {
  if (
    tasksModal &&
    !tasksModal.contains(e.target) &&
    btnTasksToggle &&
    !btnTasksToggle.contains(e.target)
  ) {
    tasksModal.classList.add("hidden");
  }
});

// Cargar tareas al iniciar
renderTasks();

// --- 16. EFECTO DE AUDIO TRIUNFAL PARA EL COFRE (LOOT BOX CHIME) ---
function playChestUnlockSound() {
  try {
    unlockAudioContext();
    if (!audioCtx) return;

    // Notas musicales ascendentes para simular un "Level Up" o desbloqueo de cofre (Acorde de Do mayor alegre)
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, index) => {
      setTimeout(() => {
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "triangle"; // Sonido un poco más brillante y rico que la onda senoidal pura
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioCtx.currentTime + 0.5,
        );

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      }, index * 100); // Pequeño retraso secuencial entre nota y nota
    });
  } catch (e) {
    console.log("Error al reproducir sonido del cofre:", e);
  }
}

// --- 7. EVENT LISTENERS ---
if (btnStart) btnStart.addEventListener("click", startTimer);
if (btnWork) btnWork.addEventListener("click", () => switchMode("work"));
if (btnShortBreak)
  btnShortBreak.addEventListener("click", () => switchMode("shortBreak"));
if (btnLongBreak)
  btnLongBreak.addEventListener("click", () => switchMode("longBreak"));
