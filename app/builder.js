// Assistant de création : guide l'utilisateur étape par étape et met à jour l'aperçu en direct.
// Tout se passe dans le navigateur : rien n'est envoyé à un serveur.
(function () {
  "use strict";
  var R = window.SMRender, ACTS = window.SM_ACTIVITES || [], CFG = window.SM_CONFIG || {};
  var KEY = "site-malin-projet";
  var COLORS = ["#0f766e", "#1d4ed8", "#4338ca", "#7c3aed", "#be185d", "#b91c1c", "#b45309", "#166534", "#0f172a"];
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var steps = $$(".b-step");
  var d = null, step = 0, timer = null;

  function store(fn) { try { return fn(window.localStorage); } catch (e) { return null; } }

  function save() {
    var note = $("#saved-note");
    var ok = store(function (ls) { ls.setItem(KEY, JSON.stringify({ d: d, step: step })); return true; });
    if (!ok) {
      // Trop lourd avec les images : on garde au moins les textes.
      var light = JSON.parse(JSON.stringify(d));
      light.photo = light.logo = "";
      light.offre.forEach(function (o) { o.photo = ""; });
      ok = store(function (ls) { ls.setItem(KEY, JSON.stringify({ d: light, step: step })); return true; });
      note.textContent = ok ? "Brouillon enregistré sur cet appareil (sans les photos, trop lourdes). Pensez à « Enregistrer mon projet » à la fin." : "";
    } else {
      note.textContent = "✓ Brouillon enregistré automatiquement sur cet appareil.";
    }
  }

  function siteHtml() { return R.render(d, { creditUrl: CFG.creditUrl }); }

  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var f = $("#preview");
      var y = 0;
      try { y = f.contentWindow.scrollY; } catch (e) { /* aperçu isolé */ }
      f.srcdoc = siteHtml() + (y ? "<script>addEventListener('load',function(){scrollTo(0," + y + ")})<\/script>" : "");
      save();
      warnContact();
    }, 250);
  }

  // ---------- Étapes ----------
  function drawSteps() {
    $("#steps").innerHTML = steps.map(function (s, i) {
      var cls = i === step ? "on" : i < step ? "done" : "";
      return '<li class="' + cls + '"><button type="button" data-go="' + i + '"' + (!d && i > 0 ? " disabled" : "") + ">" +
        '<span class="n">' + (i < step ? "✓" : i + 1) + "</span>" + s.getAttribute("data-title") + "</button></li>";
    }).join("");
  }

  function go(i) {
    if (!d && i > 0) return;
    step = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (s, k) { s.hidden = k !== step; });
    $("#prev").style.visibility = step === 0 ? "hidden" : "";
    $("#next").style.display = step === steps.length - 1 || (step === 0 && !d) ? "none" : "";
    $("#next").textContent = step === steps.length - 2 ? "Dernière étape : publier →" : "Continuer →";
    drawSteps();
    if (d) { fillForm(); save(); }
    var side = $(".b-side");
    if (side) side.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  // ---------- Étape 0 : activité ----------
  function drawActs() {
    $("#acts").innerHTML = ACTS.map(function (a) {
      return '<button type="button" class="b-act' + (d && d.activite === a.id ? " on" : "") + '" data-act="' + a.id + '">' +
        '<span class="e">' + a.emoji + "</span>" + R.esc(a.nom) + "</button>";
    }).join("");
  }

  function chooseActivity(id) {
    var a = ACTS.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    if (d && d.activite !== id && !confirm("Changer d'activité remplace les textes et produits par ceux du nouveau modèle. Continuer ?")) return;
    if (!d || d.activite !== id) {
      d = R.fromActivity(a);
      d.apropos_auto = true;
      d.apropos = R.fill(a.apropos, d);
    }
    drawActs();
    refresh();
    go(1);
  }

  // ---------- Formulaire ----------
  function fillForm() {
    $$("[data-k]").forEach(function (el) {
      var k = el.getAttribute("data-k");
      if (el.type === "checkbox") el.checked = d[k] !== false;
      else if (document.activeElement !== el) el.value = d[k] == null ? "" : d[k];
    });
    $("#themes").innerHTML = Object.keys(R.THEMES).map(function (k) {
      var t = R.THEMES[k];
      return '<button type="button" class="b-theme' + (d.theme === k ? " on" : "") + '" data-theme="' + k + '" style="font-family:' +
        t.head.replace(/"/g, "'") + ";background:" + t.bg + ";color:" + t.text + ";border-radius:" + t.radius + '">' +
        '<span style="background:' + d.couleur + '"></span>' + t.label + "</button>";
    }).join("");
    var colors = COLORS.indexOf(d.couleur) === -1 ? COLORS.concat([d.couleur]) : COLORS;
    $("#colors").innerHTML = colors.map(function (c) {
      return '<button type="button" class="b-color' + (d.couleur === c ? " on" : "") + '" data-color="' + c + '" style="background:' + c + '" aria-label="Couleur ' + c + '"></button>';
    }).join("") + '<label class="b-color custom" title="Autre couleur">+<input type="color" id="f-color" value="' + d.couleur + '"></label>';
    $("#commande").innerHTML = Object.keys(R.COMMANDES).map(function (k) {
      return '<label class="b-radio"><input type="radio" name="commande" value="' + k + '"' + (d.commande === k ? " checked" : "") + "> " + R.COMMANDES[k] + "</label>";
    }).join("");
    $$("[data-clear]").forEach(function (b) { b.hidden = !d[b.getAttribute("data-clear")]; });
    drawItems();
    $("#publish-aff").innerHTML = CFG.affiliateHtml ? '<aside class="affiliate">' + CFG.affiliateHtml + "</aside>" : "";
  }

  function drawItems() {
    var box = $("#items");
    if (box.contains(document.activeElement)) return; // ne pas perdre la saisie en cours
    box.innerHTML = d.offre.map(function (o, i) {
      return '<fieldset class="b-item" data-i="' + i + '"><legend>Produit ou service ' + (i + 1) + "</legend>" +
        '<label>Nom</label><input data-ik="nom" value="' + R.esc(o.nom) + '" maxlength="60">' +
        '<label>Description</label><input data-ik="desc" value="' + R.esc(o.desc) + '" maxlength="140">' +
        '<div class="b-row"><div><label>Prix en €</label><input data-ik="prix" inputmode="decimal" value="' + R.esc(o.prix) + '"></div>' +
        '<div><label>Photo</label><input type="file" accept="image/*" data-iimg="' + i + '">' +
        (o.photo ? ' <button type="button" class="b-x" data-iclear="' + i + '">Retirer la photo</button>' : "") + "</div></div>" +
        (d.commande === "liens" ? '<label>Lien de paiement <span class="muted">(PayPal, Stripe, SumUp…)</span></label><input data-ik="lien" value="' +
          R.esc(o.lien) + '" placeholder="https://…">' : "") +
        '<div class="b-item-tools"><button type="button" class="b-x" data-up="' + i + '"' + (i === 0 ? " disabled" : "") + '>↑ Monter</button>' +
        '<button type="button" class="b-x" data-del="' + i + '">Supprimer</button></div></fieldset>';
    }).join("");
  }

  function warnContact() {
    var w = $("#contact-warn"), msg = "";
    if (d.commande === "whatsapp" && !R.waNumber(d.whatsapp)) msg = "Vous avez choisi de recevoir les commandes sur WhatsApp : indiquez votre numéro WhatsApp.";
    if (d.commande === "email" && !/@/.test(d.email || "")) msg = "Vous avez choisi de recevoir les commandes par e-mail : indiquez votre adresse e-mail.";
    if (!msg && !d.telephone && !d.whatsapp && !d.email) msg = "Ajoutez au moins un moyen de vous contacter.";
    w.textContent = msg;
    w.hidden = !msg;
  }

  // ---------- Images : réduites dans le navigateur ----------
  function readImage(file, max, cb) {
    if (!file || !/^image\//.test(file.type)) return;
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        cb(max <= 400 ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = function () { alert("Cette image n'a pas pu être lue. Essayez une photo au format JPG ou PNG."); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  // ---------- Fichier zip (sans compression, sans bibliothèque) ----------
  var CRC = (function () {
    var t = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(b) {
    var c = 0xffffffff;
    for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.content), crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var size = central.reduce(function (s, p) { return s + p.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, size, true); e.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: "application/zip" });
  }

  function download(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- Événements ----------
  document.addEventListener("click", function (e) {
    var b = e.target.closest("button, [data-act]");
    if (!b) return;
    if (b.hasAttribute("data-act")) return chooseActivity(b.getAttribute("data-act"));
    if (b.hasAttribute("data-go")) return go(+b.getAttribute("data-go"));
    if (b.hasAttribute("data-theme")) { d.theme = b.getAttribute("data-theme"); fillForm(); return refresh(); }
    if (b.hasAttribute("data-color")) { d.couleur = b.getAttribute("data-color"); fillForm(); return refresh(); }
    if (b.hasAttribute("data-clear")) { d[b.getAttribute("data-clear")] = ""; fillForm(); return refresh(); }
    if (b.hasAttribute("data-iclear")) { d.offre[+b.getAttribute("data-iclear")].photo = ""; drawItems(); return refresh(); }
    if (b.hasAttribute("data-del")) { d.offre.splice(+b.getAttribute("data-del"), 1); drawItems(); return refresh(); }
    if (b.hasAttribute("data-up")) {
      var i = +b.getAttribute("data-up");
      d.offre.splice(i - 1, 0, d.offre.splice(i, 1)[0]);
      drawItems();
      return refresh();
    }
    if (b.hasAttribute("data-view")) {
      $$(".b-tab").forEach(function (x) { x.classList.toggle("on", x === b); });
      $("#builder").classList.toggle("show-preview", b.getAttribute("data-view") === "preview");
      return;
    }
    if (b.hasAttribute("data-w")) {
      $$(".b-device button").forEach(function (x) { x.classList.toggle("on", x === b); });
      $("#preview").style.maxWidth = b.getAttribute("data-w");
      return;
    }
    switch (b.id) {
      case "next": return go(step + 1);
      case "prev": return go(step - 1);
      case "add-item":
        d.offre.push({ nom: "Nouveau produit", desc: "", prix: "", photo: "", lien: "" });
        drawItems();
        return refresh();
      case "download":
        download(zip([{ name: "index.html", content: siteHtml() }]), "mon-site.zip");
        b.textContent = "✓ Téléchargé ! Passez à l'étape 2";
        return;
      case "save-project":
        return download(new Blob([JSON.stringify(d)], { type: "application/json" }), "projet-site-malin.json");
      case "open-full":
        return window.open(URL.createObjectURL(new Blob([siteHtml()], { type: "text/html" })), "_blank");
    }
  });

  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!d) return;
    if (el.hasAttribute("data-k")) {
      var k = el.getAttribute("data-k");
      d[k] = el.type === "checkbox" ? el.checked : el.value;
      if (k === "apropos") d.apropos_auto = false;
      if ((k === "nom" || k === "ville") && d.apropos_auto) {
        var a = ACTS.filter(function (x) { return x.id === d.activite; })[0];
        if (a) { d.apropos = R.fill(a.apropos, d); $("#f-apropos").value = d.apropos; }
      }
      return refresh();
    }
    if (el.hasAttribute("data-ik")) {
      var i = +el.closest("[data-i]").getAttribute("data-i");
      d.offre[i][el.getAttribute("data-ik")] = el.value;
      return refresh();
    }
    if (el.id === "f-color") { d.couleur = el.value; return refresh(); }
  });

  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.id === "f-color" && d) { fillForm(); return; }
    if (el.name === "commande") { d.commande = el.value; drawItems(); return refresh(); }
    if (el.id === "f-credit") { d.credit = el.checked; return refresh(); }
    if (el.hasAttribute("data-img") && el.files[0]) {
      readImage(el.files[0], +el.getAttribute("data-max"), function (url) { d[el.getAttribute("data-img")] = url; fillForm(); refresh(); });
      return;
    }
    if (el.hasAttribute("data-iimg") && el.files[0]) {
      var i = +el.getAttribute("data-iimg");
      readImage(el.files[0], 900, function (url) { d.offre[i].photo = url; el.blur(); drawItems(); refresh(); });
      return;
    }
    if (el.id === "import" && el.files[0]) {
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var p = JSON.parse(fr.result);
          if (!p || !Array.isArray(p.offre)) throw new Error();
          d = p;
          drawActs();
          refresh();
          go(1);
        } catch (err) { alert("Ce fichier n'est pas un projet Site Malin."); }
      };
      fr.readAsText(el.files[0]);
    }
  });

  // ---------- Démarrage ----------
  var saved = store(function (ls) { return JSON.parse(ls.getItem(KEY) || "null"); });
  var wanted = (location.search.match(/[?&]modele=([\w-]+)/) || [])[1];
  if (saved && saved.d && Array.isArray(saved.d.offre)) { d = saved.d; step = saved.step || 1; }
  drawActs();
  if (wanted && (!d || d.activite !== wanted)) {
    var a = ACTS.filter(function (x) { return x.id === wanted; })[0];
    if (a && (!d || confirm("Commencer un nouveau site avec le modèle « " + a.nom + " » ? Votre brouillon actuel sera remplacé."))) {
      d = null;
      chooseActivity(wanted);
      return;
    }
  }
  if (d) refresh();
  go(d ? step : 0);
})();
