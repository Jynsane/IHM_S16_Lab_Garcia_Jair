(() => {
  "use strict";

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;

  const elements = {
    body: document.body,
    status: document.querySelector("#status"),
    transcript: document.querySelector("#transcript"),
    micButton: document.querySelector("#mic-button"),
    micHint: document.querySelector("#mic-hint"),
    form: document.querySelector("#text-form"),
    question: document.querySelector("#question"),
    result: document.querySelector("#result"),
    resultKicker: document.querySelector("#result-kicker"),
    resultTitle: document.querySelector("#result-title"),
    eventList: document.querySelector("#event-list"),
    suggestions: document.querySelector("#suggestions"),
    repeatButton: document.querySelector("#repeat-button"),
    correctButton: document.querySelector("#correct-button"),
    helpButton: document.querySelector("#help-button"),
    toast: document.querySelector("#toast")
  };

  const demoSchedule = {
    classes: [
      { time: "08:00", name: "Diseño de interfaces", room: "Aula B-204" },
      { time: "10:00", name: "Interacción Hombre-Máquina", room: "Laboratorio C-102" }
    ],
    evaluations: [
      { time: "09:00", name: "Evaluación de ejemplo: Usabilidad", room: "Aula B-204" }
    ]
  };

  let state = "idle";
  let lastAnswer = "";
  let toastTimer;

  if (recognition) {
    recognition.lang = "es";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setState("listening");
      elements.status.textContent = "Te escucho. Puedes hablar con naturalidad.";
      elements.transcript.textContent = "Di «clases», «evaluaciones» o una fecha.";
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText += text;
        else interimText += text;
      }
      if (interimText) elements.transcript.textContent = `Te escucho: «${interimText.trim()}»`;
      if (finalText.trim()) handleQuery(finalText.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      setState("idle");
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        elements.status.textContent = "No tengo permiso para usar el micrófono.";
        elements.transcript.textContent = "Puedes escribir tu pregunta en el campo de abajo.";
        showToast("No se concedió permiso para el micrófono. Escribe tu pregunta para continuar.");
      } else if (event.error === "no-speech") {
        elements.status.textContent = "No alcancé a escucharte.";
        elements.transcript.textContent = "Inténtalo de nuevo o escribe tu pregunta.";
      } else {
        elements.status.textContent = "No pude reconocer la voz.";
        elements.transcript.textContent = "Puedes volver a intentarlo o escribir tu pregunta.";
        showToast("El reconocimiento de voz no está disponible en este momento.");
      }
    };
    recognition.onend = () => {
      if (state === "listening") setState("idle");
    };
  }

  elements.micButton.addEventListener("click", () => {
    if (!recognition) {
      elements.status.textContent = "El reconocimiento de voz no está disponible aquí.";
      elements.transcript.textContent = "Escribe tu pregunta o prueba otro navegador compatible.";
      elements.question.focus();
      showToast("Usa el campo de texto: este navegador no ofrece reconocimiento de voz.");
      return;
    }

    if (state === "listening") {
      recognition.stop();
      setState("idle");
      elements.status.textContent = "Escucha detenida.";
      elements.transcript.textContent = "Puedes volver a intentarlo cuando quieras.";
      return;
    }

    if (synth) synth.cancel();
    try {
      recognition.start();
    } catch (error) {
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        showToast("El micrófono ya está activo. Puedes decir «cancela» o detener la escucha.");
        return;
      }
      showToast("No se pudo iniciar el micrófono. Escribe tu pregunta para continuar.");
      elements.status.textContent = "No se pudo iniciar el micrófono.";
      elements.transcript.textContent = "Revisa el permiso del navegador o escribe tu pregunta.";
      setState("idle");
    }
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = elements.question.value.trim();
    if (!query) {
      elements.status.textContent = "Escribe una pregunta para continuar.";
      elements.question.focus();
      return;
    }
    if (state === "listening" && recognition) recognition.stop();
    handleQuery(query);
  });

  document.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => handleQuery(button.dataset.query || ""));
  });

  elements.repeatButton.addEventListener("click", () => {
    if (!lastAnswer) {
      elements.status.textContent = "Todavía no hay una respuesta para repetir.";
      elements.transcript.textContent = "Pregunta por tus clases o evaluaciones para empezar.";
      return;
    }
    elements.status.textContent = "Repito la respuesta.";
    elements.transcript.textContent = "Puedes decir «repite» cuando quieras volver a escucharla.";
    speak(lastAnswer);
  });

  elements.correctButton.addEventListener("click", () => {
    if (synth) synth.cancel();
    setState("idle");
    elements.result.hidden = true;
    elements.suggestions.hidden = false;
    elements.status.textContent = "¿Qué quieres consultar?";
    elements.transcript.textContent = "Prueba con «clases» o «evaluaciones».";
    elements.question.value = "";
    elements.question.focus();
  });

  elements.helpButton.addEventListener("click", () => {
    const help = "Puedes preguntar: ¿Qué clases tengo mañana? ¿Cuándo es mi próxima evaluación? También puedes decir repite o cancela.";
    elements.status.textContent = "Puedes preguntar de forma natural.";
    elements.transcript.textContent = `«${help}»`;
    speak(help);
  });

  function handleQuery(rawQuery) {
    const query = normalize(rawQuery);
    if (!query) return;

    elements.question.value = "";
    elements.result.hidden = true;
    elements.suggestions.hidden = false;

    if (/\b(cancelar|cancela|detente|para|parar)\b/.test(query)) {
      if (recognition && state === "listening") recognition.stop();
      if (synth) synth.cancel();
      setState("idle");
      elements.status.textContent = "Listo, cancelé la consulta.";
      elements.transcript.textContent = "Cuando quieras, puedes preguntar otra cosa.";
      return;
    }

    if (/\b(repite|repetir|otra vez)\b/.test(query) && lastAnswer) {
      elements.status.textContent = "Repito la respuesta.";
      elements.transcript.textContent = `«${rawQuery}»`;
      speak(lastAnswer);
      return;
    }

    const isEvaluation = /\b(evaluacion|evaluaciones|examen|examenes|prueba|pruebas|parcial|parciales)\b/.test(query);
    const isClass = /\b(clase|clases|horario|aula|salon|curso|cursos|materia|materias)\b/.test(query);
    const date = getRequestedDate(query);

    elements.transcript.textContent = `«${rawQuery}»`;

    if (!isEvaluation && !isClass) {
      askClarification(rawQuery);
      return;
    }

    if (isEvaluation && isClass) {
      askClarification(rawQuery);
      return;
    }

    const category = isEvaluation ? "evaluations" : "classes";
    const label = isEvaluation ? "EVALUACIONES" : "CLASES";
    const tomorrow = new Date();
    tomorrow.setHours(12, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isDemoDate = date.toDateString() === tomorrow.toDateString();
    const items = isDemoDate ? demoSchedule[category] : [];
    const dateLabel = formatDate(date);
    const title = `${isEvaluation ? "Evaluaciones" : "Clases"} · ${dateLabel}`;

    elements.resultKicker.textContent = `ENTENDÍ: ${label} · ${dateLabel.toLocaleUpperCase("es")}`;
    elements.resultTitle.textContent = title;
    elements.eventList.replaceChildren();

    if (items.length) {
      items.forEach((item) => elements.eventList.append(createEvent(item)));
      lastAnswer = `${isEvaluation ? "Evaluaciones" : "Clases"} para ${dateLabel}: ${items.map((item) => `${item.name}, a las ${item.time}, en ${item.room}`).join(". ")}`;
    } else {
      const empty = document.createElement("p");
      empty.className = "empty-result";
      empty.textContent = `No encuentro ${isEvaluation ? "evaluaciones" : "clases"} para ${dateLabel.toLocaleLowerCase("es")} en el horario de demostración. Puedes preguntar por otra fecha o cambiar el tipo de consulta.`;
      elements.eventList.append(empty);
      lastAnswer = empty.textContent;
    }

    elements.result.hidden = false;
    elements.suggestions.hidden = true;
    elements.status.textContent = "Encontré tu información.";
    elements.transcript.textContent = "Esta agenda es un ejemplo; no está conectada a datos reales.";
    speak(lastAnswer);
  }

  function askClarification(query) {
    setState("idle");
    elements.result.hidden = true;
    elements.suggestions.hidden = false;
    const question = `Entendí «${query}», pero no sé si buscas clases o evaluaciones. Di «clases» o «evaluaciones».`;
    elements.status.textContent = "¿Buscas clases o evaluaciones?";
    elements.transcript.textContent = "Di «clases» o «evaluaciones», o elige una sugerencia.";
    speak(question);
  }

  function createEvent(item) {
    const card = document.createElement("article");
    card.className = "event";
    const time = document.createElement("span");
    time.className = "event-time";
    time.textContent = item.time;
    const details = document.createElement("div");
    const name = document.createElement("p");
    name.className = "event-name";
    name.textContent = item.name;
    const room = document.createElement("p");
    room.className = "event-room";
    room.textContent = item.room;
    details.append(name, room);
    card.append(time, details);
    return card;
  }

  function getRequestedDate(query) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    if (/\b(hoy|ahora)\b/.test(query)) return date;
    if (/\bpasado manana\b/.test(query)) date.setDate(date.getDate() + 2);
    else if (/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(query)) {
      const days = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
      const desired = days.findIndex((day) => query.includes(day));
      let offset = (desired - date.getDay() + 7) % 7;
      if (offset === 0) offset = 7;
      date.setDate(date.getDate() + offset);
    } else {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(date);
  }

  function normalize(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function speak(text) {
    if (!synth || !text) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es";
    utterance.rate = 0.96;
    utterance.onstart = () => setState("speaking");
    utterance.onend = () => {
      if (state === "speaking") setState("idle");
    };
    utterance.onerror = () => {
      if (state === "speaking") setState("idle");
    };
    synth.speak(utterance);
  }

  function setState(nextState) {
    state = nextState;
    elements.body.classList.toggle("is-listening", nextState === "listening");
    elements.body.classList.toggle("is-speaking", nextState === "speaking");
    elements.body.classList.toggle("is-processing", nextState === "processing");
    elements.micButton.classList.toggle("is-listening", nextState === "listening");
    elements.micButton.setAttribute("aria-label", nextState === "listening" ? "Detener escucha" : "Empezar a hablar");
    elements.micHint.textContent = nextState === "listening" ? "Toca para detener" : "Toca para hablar";
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 4200);
  }
})();
