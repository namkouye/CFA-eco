(function () {
  "use strict";

  // ---------- État ----------
  const KEY = "cfa-eco-v1";
  const blank = { completed: {}, scores: {}, streak: 0, lastDay: null, missed: [], examDate: null };

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      return Object.assign({}, blank, s, {
        completed: s.completed || {}, scores: s.scores || {}, missed: s.missed || []
      });
    } catch (e) { return Object.assign({}, blank, { completed: {}, scores: {}, missed: [] }); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  let state = load();
  let tab = "today";
  let session = null;

  const $app = document.getElementById("app");

  // ---------- Utilitaires ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const dayKey = (d) => (d || new Date()).toLocaleDateString("en-CA");
  const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  const byId = (id) => LESSONS.find((l) => l.id === id);
  const plural = (n, one, many) => n + " " + (n > 1 ? many : one);

  function nextLesson() { return LESSONS.find((l) => !state.completed[l.id]) || null; }
  function doneToday() { return state.lastDay === dayKey(); }
  function currentStreak() {
    if (state.lastDay === dayKey() || state.lastDay === yesterdayKey()) return state.streak;
    return 0;
  }
  function daysToExam() {
    if (!state.examDate) return null;
    const ms = new Date(state.examDate + "T00:00:00") - new Date(dayKey() + "T00:00:00");
    return Math.round(ms / 86400000);
  }
  function modKeys() { return Object.keys(MODULES).filter((k) => LESSONS.some((l) => String(l.module) === k)); }
  function modPill(l) {
    return '<span class="pill" style="background:#0f766e">Module ' + l.module + " · " + esc(MODULES[l.module].fr) + "</span>";
  }
  function planLine(left) {
    const d = daysToExam();
    if (d === null) return "Indiquez la date de votre examen dans Réglages pour obtenir un rythme quotidien.";
    if (left === 0) return "Cours terminé. Utilisez Révision et l'onglet Cours pour réviser.";
    if (d <= 0) return "La date de l'examen est passée. Mettez-la à jour dans Réglages.";
    if (d >= left) return plural(left, "leçon restante", "leçons restantes") + " et " + plural(d, "jour", "jours") + " : une leçon par jour suffit, avec " + plural(d - left, "jour", "jours") + " de marge pour réviser.";
    return plural(left, "leçon restante", "leçons restantes") + " pour " + plural(d, "jour", "jours") + " : visez environ " + Math.ceil(left / d) + " leçons par jour pour finir à temps.";
  }

  // ---------- Vues ----------
  function viewToday() {
    const done = LESSONS.filter((l) => state.completed[l.id]).length;
    const total = LESSONS.length;
    const pct = Math.round((done / total) * 100);
    const exam = daysToExam();
    const next = nextLesson();

    let html = "<h1>CFA Économie</h1><p class='muted'>Niveau I · une micro-leçon par jour</p>";
    html += '<div class="stats">' +
      '<div class="stat"><b>' + currentStreak() + '</b><span>jours d\'affilée</span></div>' +
      '<div class="stat"><b>' + done + "/" + total + '</b><span>leçons faites</span></div>' +
      '<div class="stat"><b>' + (exam === null ? "-" : exam < 0 ? "Passé" : exam) + '</b><span>' + (exam === null ? "date d'examen" : "jours avant l'examen") + "</span></div></div>";
    html += '<div class="bar"><i style="width:' + pct + '%"></i></div>';
    html += '<p class="muted plan" style="margin-top:8px">' + esc(planLine(total - done)) + "</p>";

    if (!next) {
      html += '<div class="card center"><div class="big">🎉</div><h3>Toutes les leçons sont terminées</h3>' +
        '<p class="muted">Utilisez Révision pour les questions ratées, ou rouvrez une leçon depuis l\'onglet Cours.</p></div>';
    } else if (doneToday()) {
      html += '<div class="card center"><div class="big">✅</div><h3>Séance du jour terminée</h3>' +
        '<p class="muted">Bravo. Revenez demain pour garder votre série. Prochaine leçon : ' + esc(next.title) + ".</p>" +
        '<button class="btn secondary" data-act="start" data-id="' + next.id + '">Faire la suivante quand même</button></div>';
    } else {
      const inMod = LESSONS.filter((l) => l.module === next.module).length;
      html += '<div class="card"><div class="row"><span class="muted">Leçon du jour · ' + next.n + " sur " + inMod + ' du module ' + next.module + '</span><span class="muted">~' + next.minutes + " min</span></div>" +
        "<h2 style='margin-top:8px'>" + esc(next.title) + "</h2>" + modPill(next) +
        "<p class='muted' style='margin-top:10px'>" + esc(next.summary) + "</p>" +
        '<button class="btn" data-act="start" data-id="' + next.id + '">Commencer la leçon</button></div>';
    }

    if (state.missed.length) {
      html += '<div class="card row"><div><h3>' + plural(state.missed.length, "question à revoir", "questions à revoir") + "</h3>" +
        '<span class="muted">Elles reviennent jusqu\'à ce que vous répondiez juste.</span></div>' +
        '<button class="btn small" data-act="tab" data-tab="review">Réviser</button></div>';
    }

    html += "<h2>Progression par module</h2>";
    modKeys().forEach((k) => {
      const ls = LESSONS.filter((l) => String(l.module) === k);
      const d = ls.filter((l) => state.completed[l.id]).length;
      html += '<div style="margin:10px 0"><div class="row"><span>' + k + ". " + esc(MODULES[k].fr) +
        '</span><span class="muted">' + d + "/" + ls.length + '</span></div>' +
        '<div class="bar"><i style="width:' + (d / ls.length) * 100 + '%"></i></div></div>';
    });
    return html;
  }

  function viewLibrary() {
    let html = "<h1>Cours</h1><p class='muted'>Touchez une leçon pour l'étudier ou la revoir.</p>";
    modKeys().forEach((k) => {
      const ls = LESSONS.filter((l) => String(l.module) === k);
      html += '<div class="modhead"><h2>' + k + ". " + esc(MODULES[k].fr) + '</h2></div><div class="muted" style="margin:-4px 0 6px;font-size:.8rem">' + esc(MODULES[k].en) + '</div><div class="card" style="padding:4px 16px">';
      ls.forEach((l) => {
        const sc = state.scores[l.id];
        html += '<div class="lesson-item" data-act="start" data-id="' + l.id + '"><div><div><span class="num">' + l.n + ".</span> " + esc(l.title) +
          '</div><span class="muted">~' + l.minutes + " min" + (sc !== undefined ? " · meilleur score " + sc + "/" + l.quiz.length : "") + "</span></div>" +
          (state.completed[l.id] ? '<span class="check">✓</span>' : '<span class="muted">›</span>') + "</div>";
      });
      html += "</div>";
    });
    return html;
  }

  function viewReview() {
    if (session && session.mode === "review") return viewQuestion();
    const html = "<h1>Révision</h1>";
    if (!state.missed.length) {
      return html + '<div class="card center"><div class="big">🧠</div><h3>Rien à réviser</h3>' +
        '<p class="muted">Les questions ratées pendant les leçons apparaîtront ici.</p></div>';
    }
    return html + "<p class='muted'>" + plural(state.missed.length, "question en attente", "questions en attente") + ". Répondez juste pour la retirer.</p>" +
      '<button class="btn" data-act="startReview">Lancer la révision</button>';
  }

  function viewSettings() {
    return "<h1>Réglages</h1>" +
      '<div class="card"><h3>Date de l\'examen</h3><p class="muted">Sert au compte à rebours et au rythme conseillé sur l\'écran du jour.</p>' +
      '<input type="date" id="examDate" value="' + esc(state.examDate || "") + '"></div>' +
      '<div class="card"><h3>Installer sur le téléphone</h3><p class="muted">iPhone : Partager → Sur l\'écran d\'accueil. ' +
      "Android/Chrome : menu → Installer l'application. Elle fonctionne ensuite hors connexion, comme une application normale.</p></div>" +
      '<div class="card"><h3>Réinitialiser</h3><p class="muted">Efface la série, les leçons terminées et les questions à revoir sur cet appareil.</p>' +
      '<button class="btn secondary" data-act="reset">Tout effacer</button></div>' +
      '<p class="muted">CFA Économie est un outil d\'étude indépendant, sans lien avec le CFA Institute. ' +
      "Les leçons sont rédigées avec des mots originaux à partir du curriculum 2026 (volume 2, Économie) ; elles complètent le curriculum officiel sans le remplacer. Chaque leçon indique la section et les pages à relire.</p>";
  }

  // ---------- Séance de leçon ----------
  // phases : read -> practice -> quiz -> done
  function startLesson(id) {
    const lesson = byId(id);
    if (!lesson) return;
    session = { mode: "lesson", lesson: lesson, phase: "read", qi: 0, correct: 0, answered: null, showSol: false };
    tab = "today";
    render();
    window.scrollTo(0, 0);
  }

  function startReview() {
    session = { mode: "review", queue: state.missed.slice(), idx: 0, answered: null };
    render();
  }

  function stepBar(n) {
    return '<div class="steps">' + [0, 1, 2].map((i) => '<i class="' + (i <= n ? "on" : "") + '"></i>').join("") + "</div>";
  }

  function viewLesson() {
    const L = session.lesson;
    const topBar = '<button class="btn small secondary" data-act="exit">← Retour</button>';

    if (session.phase === "read") {
      let html = topBar + stepBar(0) + modPill(L) +
        "<h1 style='margin-top:8px'>" + esc(L.title) + "</h1>" +
        "<p class='muted'>Leçon " + L.n + " du module " + L.module + " · ~" + L.minutes + " min</p>" +
        '<p class="lead">' + rich(L.summary) + "</p>" +
        '<div class="goal"><b>À la fin, vous saurez</b>' + rich(L.objective) + "</div>";
      L.sections.forEach((s) => {
        html += '<div class="card sec"><h3>' + esc(s.heading) + "</h3>" +
          s.body.map((p) => "<p>" + rich(p) + "</p>").join("") +
          (s.bullets && s.bullets.length ? '<ul class="points">' + s.bullets.map((b) => "<li>" + rich(b) + "</li>").join("") + "</ul>" : "") +
          "</div>";
      });
      if (L.terms && L.terms.length) {
        html += '<div class="card"><h3>Vocabulaire de l\'examen</h3><dl class="terms">' +
          L.terms.map((t) => "<dt>" + esc(t.en) + "</dt><dd>" + rich(t.fr) + "</dd>").join("") + "</dl></div>";
      }
      if (L.formulas && L.formulas.length) {
        html += '<div class="card"><h3>Formules clés</h3>' + L.formulas.map((f) => '<div class="formula">' + esc(f) + "</div>").join("") + "</div>";
      }
      html += '<p class="src">À relire dans le curriculum : ' + esc(L.source) + "</p>";
      html += '<button class="btn" data-act="toPractice">' + (L.example ? "Exemple, pièges et résumé →" : "Pièges et résumé →") + "</button>";
      return html;
    }

    if (session.phase === "practice") {
      let html = topBar + stepBar(1) + "<h1>" + esc(L.title) + "</h1>";
      if (L.example) {
        html += '<div class="card"><h3>Exemple : ' + esc(L.example.title) + "</h3>" +
          "<p>" + rich(L.example.problem) + "</p>" +
          (session.showSol
            ? '<div class="sol"><b>Solution</b><p style="margin:6px 0 0">' + rich(L.example.solution) + "</p></div>"
            : '<p class="muted" style="margin-bottom:10px">Essayez d\'abord seul, puis vérifiez.</p><button class="btn secondary" data-act="showSol">Voir la solution</button>') +
          "</div>";
      }
      html += '<div class="card warn"><h3>Pièges classiques de l\'examen</h3><ul class="points">' + L.mistakes.map((m) => "<li>" + rich(m) + "</li>").join("") + "</ul></div>" +
        '<div class="card"><h3>À retenir</h3><ul class="points">' + L.recap.map((m) => "<li>" + rich(m) + "</li>").join("") + "</ul></div>" +
        '<button class="btn" data-act="toQuiz">Passer le quiz (' + L.quiz.length + " questions) →</button>";
      return html;
    }

    if (session.phase === "quiz") return viewQuestion();

    const total = L.quiz.length;
    const nxt = nextLesson();
    return stepBar(2) + '<div class="card center"><div class="big">' + (session.correct === total ? "🌟" : "👍") + "</div>" +
      "<h2 style='margin-top:0'>Leçon terminée</h2><p>Score : <b>" + session.correct + " sur " + total + "</b></p>" +
      '<p class="muted">' + (currentStreak() > 0 ? "🔥 " + plural(currentStreak(), "jour d'affilée", "jours d'affilée") : "") + "</p>" +
      (state.missed.some((m) => m.lessonId === L.id) ? '<p class="muted">Les questions ratées ont été ajoutées à la Révision.</p>' : "") + "</div>" +
      '<button class="btn" data-act="exit">Terminer</button>' +
      (nxt && nxt.id !== L.id ? '<div class="gap"></div><button class="btn secondary" data-act="start" data-id="' + nxt.id + '">Suivante : ' + esc(nxt.title) + "</button>" : "");
  }

  function currentQuestion() {
    if (session.mode === "review") {
      const m = session.queue[session.idx];
      if (!m) return null;
      const l = byId(m.lessonId);
      return l && l.quiz[m.qi] ? { q: l.quiz[m.qi], lesson: l, qi: m.qi } : null;
    }
    return { q: session.lesson.quiz[session.qi], lesson: session.lesson, qi: session.qi };
  }

  function viewQuestion() {
    const cur = currentQuestion();
    if (!cur) {
      session = null;
      return "<h1>Révision</h1><div class='card center'><div class='big'>🎯</div><h3>Révision terminée</h3>" +
        "<p class='muted'>" + plural(state.missed.length, "question reste", "questions restent") + " dans la file.</p></div>";
    }
    const q = cur.q;
    const a = session.answered;
    let html = '<button class="btn small secondary" data-act="exit">← Retour</button>';
    if (session.mode === "lesson") {
      html += stepBar(2) + "<p class='muted'>Question " + (session.qi + 1) + " sur " + cur.lesson.quiz.length + "</p>";
    } else {
      html += "<p class='muted' style='margin-top:12px'>Révision " + (session.idx + 1) + " sur " + session.queue.length + " · " + esc(cur.lesson.title) + "</p>";
    }
    html += "<h2 style='margin-top:6px'>" + rich(q.q) + "</h2>";
    q.options.forEach((o, i) => {
      let cls = "opt";
      if (a !== null) { if (i === q.answer) cls += " good"; else if (i === a) cls += " bad"; }
      html += '<button class="' + cls + '" data-act="answer" data-i="' + i + '"' + (a !== null ? " disabled" : "") + ">" + esc(o) + "</button>";
    });
    if (a !== null) {
      html += '<div class="why"><b>' + (a === q.answer ? "Correct." : "Pas tout à fait.") + "</b> " + rich(q.why) + "</div>" +
        '<div style="margin-top:14px"><button class="btn" data-act="next">Suivant →</button></div>';
    }
    return html;
  }

  function answer(i) {
    if (!session || session.answered !== null) return;
    session.answered = i;
    const cur = currentQuestion();
    const right = i === cur.q.answer;
    const idx = state.missed.findIndex((m) => m.lessonId === cur.lesson.id && m.qi === cur.qi);
    if (right) {
      if (session.mode === "lesson") session.correct++;
      if (idx >= 0) state.missed.splice(idx, 1);
    } else if (idx < 0) {
      state.missed.push({ lessonId: cur.lesson.id, qi: cur.qi });
    }
    save();
    render();
  }

  function next() {
    session.answered = null;
    if (session.mode === "review") { session.idx++; render(); return; }
    session.qi++;
    if (session.qi >= session.lesson.quiz.length) {
      completeLesson();
      session.phase = "done";
    }
    render();
    window.scrollTo(0, 0);
  }

  function completeLesson() {
    const L = session.lesson;
    const today = dayKey();
    state.scores[L.id] = Math.max(state.scores[L.id] || 0, session.correct);
    if (!state.completed[L.id]) state.completed[L.id] = today;
    if (state.lastDay !== today) {
      state.streak = state.lastDay === yesterdayKey() ? state.streak + 1 : 1;
      state.lastDay = today;
    }
    save();
  }

  // ---------- Rendu et événements ----------
  function render() {
    let html;
    if (session && session.mode === "lesson") html = viewLesson();
    else if (tab === "today") html = viewToday();
    else if (tab === "library") html = viewLibrary();
    else if (tab === "review") html = viewReview();
    else html = viewSettings();
    $app.innerHTML = html;
    const inLesson = !!(session && session.mode === "lesson");
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab && !inLesson));
    const d = document.getElementById("examDate");
    if (d) d.addEventListener("change", () => { state.examDate = d.value || null; save(); });
  }

  document.addEventListener("click", (e) => {
    const tabBtn = e.target.closest("#tabs button");
    if (tabBtn) { session = null; tab = tabBtn.dataset.tab; render(); window.scrollTo(0, 0); return; }
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    if (act === "start") startLesson(el.dataset.id);
    else if (act === "toPractice") { session.phase = "practice"; session.showSol = false; render(); window.scrollTo(0, 0); }
    else if (act === "showSol") { session.showSol = true; render(); }
    else if (act === "toQuiz") { session.phase = "quiz"; session.qi = 0; session.correct = 0; session.answered = null; render(); window.scrollTo(0, 0); }
    else if (act === "answer") answer(parseInt(el.dataset.i, 10));
    else if (act === "next") next();
    else if (act === "exit") { session = null; render(); window.scrollTo(0, 0); }
    else if (act === "tab") { session = null; tab = el.dataset.tab; render(); }
    else if (act === "startReview") startReview();
    else if (act === "reset") {
      if (confirm("Effacer toute la progression sur cet appareil ?")) { state = Object.assign({}, blank, { completed: {}, scores: {}, missed: [] }); save(); render(); }
    }
  });

  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
