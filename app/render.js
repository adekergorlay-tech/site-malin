// Fabrique le site d'un utilisateur : un seul fichier HTML autonome (styles, images et panier inclus).
// Utilisé dans le navigateur (assistant de création) et par scripts/check_render.js (tests).
(function (root) {
  "use strict";

  var THEMES = {
    moderne: {
      label: "Moderne",
      font: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      head: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      bg: "#f8fafc", surface: "#ffffff", text: "#0f172a", muted: "#475569", radius: "16px", weight: "800"
    },
    elegant: {
      label: "Élégant",
      font: "Georgia, 'Times New Roman', serif",
      head: "'Palatino Linotype', Palatino, Georgia, serif",
      bg: "#faf7f2", surface: "#ffffff", text: "#2b2622", muted: "#6b625a", radius: "4px", weight: "500"
    },
    chaleureux: {
      label: "Chaleureux",
      font: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
      head: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
      bg: "#fdf6ec", surface: "#fffdf8", text: "#3b2a1a", muted: "#7a6552", radius: "22px", weight: "700"
    },
    minimal: {
      label: "Minimal",
      font: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      head: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      bg: "#ffffff", surface: "#ffffff", text: "#111111", muted: "#555555", radius: "0px", weight: "600"
    }
  };

  var COMMANDES = {
    aucune: "Pas de commande en ligne (site vitrine)",
    liens: "Un lien de paiement par produit (PayPal, Stripe, SumUp…)",
    whatsapp: "Panier, commande envoyée sur mon WhatsApp",
    email: "Panier, commande envoyée sur mon e-mail"
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // N'accepte que des liens web ; ajoute https:// si la personne l'a oublié.
  function safeUrl(u) {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(u)) return "https://" + u;
    return "";
  }

  function safeImage(d) {
    return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+\/=]+$/i.test(String(d || "")) ? d : "";
  }

  function digits(s) { return String(s || "").replace(/\D/g, ""); }

  // Numéro au format international pour WhatsApp (06 12 34 56 78 -> 33612345678).
  function waNumber(s) {
    var d = digits(s);
    if (/^0\d{9}$/.test(d)) return "33" + d.slice(1);
    if (/^00/.test(d)) return d.slice(2);
    return d;
  }

  function social(u, base) {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^@?[\w.]+$/.test(u)) return base + u.replace(/^@/, "");
    return safeUrl(u);
  }

  function parsePrice(p) {
    var s = String(p == null ? "" : p).replace(/\s|€/g, "").replace(",", ".");
    if (s === "") return null;
    var n = parseFloat(s);
    return isFinite(n) && n >= 0 ? n : null;
  }

  function formatPrice(n) {
    if (n === null) return "Sur devis";
    if (n === 0) return "Offert";
    var dec = Math.round(n) === n ? 0 : 2;
    return n.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: 2 }) + " €";
  }

  function fill(text, d) {
    return String(text || "")
      .replace(/\{nom\}/g, d.nom || "")
      .replace(/\{ville_a\}/g, d.ville ? " à " + d.ville : "")
      .replace(/\{ville\}/g, d.ville || "");
  }

  // Données de départ quand on choisit une activité.
  function fromActivity(a) {
    return {
      activite: a.id,
      nom: a.exemple,
      slogan: a.slogan,
      apropos: a.apropos,
      ville: "",
      theme: a.theme,
      couleur: a.couleur,
      logo: "",
      photo: "",
      titre_offre: a.titre_offre,
      offre: a.offre.map(function (o) { return { nom: o.nom, desc: o.desc, prix: o.prix, photo: "", lien: "" }; }),
      commande: a.id === "boutique" || a.id === "fait-main" || a.id === "boulangerie" ? "whatsapp" : "aucune",
      bouton: a.bouton,
      telephone: "", whatsapp: "", email: "", adresse: "",
      horaires: a.horaires,
      instagram: "", facebook: "",
      legal_nom: "", legal_statut: "", siret: "", legal_adresse: "",
      credit: true
    };
  }

  function contrast(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "#ffffff";
    var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? "#111111" : "#ffffff";
  }

  function css(t, accent) {
    var on = contrast(accent);
    return [
      ":root{--bg:" + t.bg + ";--surface:" + t.surface + ";--text:" + t.text + ";--muted:" + t.muted +
        ";--accent:" + accent + ";--on-accent:" + on + ";--radius:" + t.radius + "}",
      "*{box-sizing:border-box}html{scroll-behavior:smooth}",
      "body{margin:0;font-family:" + t.font + ";background:var(--bg);color:var(--text);line-height:1.6}",
      "h1,h2,h3{font-family:" + t.head + ";font-weight:" + t.weight + ";line-height:1.2}",
      "a{color:var(--accent)}img{max-width:100%;display:block}",
      ".wrap{max-width:1040px;margin:0 auto;padding:0 20px}",
      "header.top{position:sticky;top:0;z-index:5;background:var(--surface);border-bottom:1px solid rgba(0,0,0,.08)}",
      "header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px}",
      ".brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:1.15rem;color:var(--text);text-decoration:none}",
      ".brand img{height:40px;width:auto;border-radius:6px}",
      "nav.menu{display:flex;gap:18px}nav.menu a{color:var(--muted);text-decoration:none;font-size:.95rem}nav.menu a:hover{color:var(--accent)}",
      ".hero{position:relative;color:#fff;background:linear-gradient(135deg,var(--accent),#111);background-size:cover;background-position:center;text-align:center}",
      ".hero:before{content:'';position:absolute;inset:0;background:rgba(0,0,0,.45)}",
      ".hero .wrap{position:relative;padding:110px 20px}",
      ".hero h1{font-size:clamp(2rem,6vw,3.4rem);margin:0 0 14px}",
      ".hero p{font-size:clamp(1.05rem,2.6vw,1.3rem);max-width:680px;margin:0 auto 28px;opacity:.95}",
      ".btn{display:inline-block;background:var(--accent);color:var(--on-accent);padding:13px 26px;border-radius:var(--radius);border:0;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}",
      ".btn:hover{filter:brightness(1.1)}.btn.ghost{background:transparent;color:var(--accent);border:2px solid var(--accent)}",
      ".hero .btn{border-radius:max(var(--radius),6px);box-shadow:0 6px 24px rgba(0,0,0,.25)}",
      "section{padding:72px 0}section h2{font-size:clamp(1.6rem,4vw,2.2rem);margin:0 0 24px;text-align:center}",
      ".about p{max-width:720px;margin:0 auto;font-size:1.12rem;text-align:center;color:var(--muted)}",
      ".offer{background:var(--surface)}",
      ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px}",
      ".item{background:var(--bg);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(0,0,0,.07)}",
      ".item img{width:100%;aspect-ratio:4/3;object-fit:cover}",
      ".item .in{padding:18px;display:flex;flex-direction:column;gap:6px;flex:1}",
      ".item h3{margin:0;font-size:1.15rem}.item p{margin:0;color:var(--muted);font-size:.95rem;flex:1}",
      ".item .price{font-weight:700;font-size:1.2rem;color:var(--accent)}",
      ".item .btn{margin-top:10px;text-align:center;padding:10px 16px}",
      ".contact .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:28px;align-items:start}",
      ".contact ul{list-style:none;padding:0;margin:0}.contact li{margin:0 0 12px}",
      ".contact .label{display:block;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}",
      ".map{width:100%;height:280px;border:0;border-radius:var(--radius)}",
      ".socials{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}",
      "footer.bottom{background:var(--text);color:var(--bg);padding:28px 0;font-size:.9rem}",
      "footer.bottom a{color:inherit}footer.bottom details{margin-top:12px}footer.bottom summary{cursor:pointer}",
      "footer.bottom .credit{opacity:.7;margin-top:14px}",
      ".cart-btn{position:fixed;right:18px;bottom:18px;z-index:9;border-radius:999px;box-shadow:0 6px 24px rgba(0,0,0,.25)}",
      ".cart{position:fixed;inset:0;z-index:10;background:rgba(0,0,0,.5);display:none;align-items:flex-end;justify-content:center}",
      ".cart.open{display:flex}",
      ".cart .panel{background:var(--surface);color:var(--text);width:100%;max-width:480px;max-height:85vh;overflow:auto;border-radius:16px 16px 0 0;padding:22px}",
      ".cart .line{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.08)}",
      ".cart .qty{display:flex;align-items:center;gap:8px}.cart .qty button{width:30px;height:30px;border-radius:50%;border:1px solid rgba(0,0,0,.2);background:var(--bg);color:var(--text);cursor:pointer;font:inherit}",
      ".cart .total{font-weight:700;font-size:1.15rem;margin:14px 0}.cart textarea{width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.2);font:inherit;margin-bottom:12px;background:var(--bg);color:var(--text)}",
      ".mobilebar{display:none}",
      "@media(max-width:700px){nav.menu{display:none}.hero .wrap{padding:80px 20px}section{padding:52px 0}",
      ".mobilebar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:8;background:var(--surface);border-top:1px solid rgba(0,0,0,.1)}",
      ".mobilebar a{flex:1;text-align:center;padding:14px;font-weight:700;text-decoration:none;color:var(--accent)}",
      "body.hasbar{padding-bottom:56px}body.hasbar .cart-btn{bottom:72px}}"
    ].join("\n");
  }

  // Script du panier, intégré au site publié (aucune dépendance, aucun serveur).
  var CART_JS = [
    "(function(){",
    "var P=JSON.parse(document.getElementById('sm-data').textContent),cart={};",
    "var box=document.getElementById('cart'),list=document.getElementById('cart-list'),count=document.getElementById('cart-count'),tot=document.getElementById('cart-total');",
    "function eur(n){return n.toLocaleString('fr-FR',{minimumFractionDigits:Math.round(n)===n?0:2,maximumFractionDigits:2})+' €'}",
    "function draw(){var n=0,t=0,h='';for(var i in cart){var p=P.items[i],q=cart[i];n+=q;t+=(p.prix||0)*q;",
    "h+='<div class=\"line\"><span>'+p.nomHtml+(p.prix!==null?' · '+eur(p.prix):'')+'</span><span class=\"qty\"><button data-d=\"-1\" data-i=\"'+i+'\" aria-label=\"Retirer\">−</button>'+q+'<button data-d=\"1\" data-i=\"'+i+'\" aria-label=\"Ajouter\">+</button></span></div>'}",
    "list.innerHTML=h||'<p>Votre panier est vide.</p>';count.textContent=n;tot.textContent=t>0?'Total : '+eur(t):'';",
    "document.getElementById('cart-open').style.display=n?'':'none'}",
    "document.addEventListener('click',function(e){var b=e.target.closest('[data-add]');if(b){var i=b.getAttribute('data-add');cart[i]=(cart[i]||0)+1;draw();box.classList.add('open');return}",
    "b=e.target.closest('[data-d]');if(b){var k=b.getAttribute('data-i');cart[k]+=+b.getAttribute('data-d');if(cart[k]<=0)delete cart[k];draw();return}",
    "if(e.target.closest('#cart-open'))box.classList.add('open');",
    "if(e.target===box||e.target.closest('#cart-close'))box.classList.remove('open')});",
    "document.getElementById('cart-send').addEventListener('click',function(){var m='Bonjour, je souhaite commander :\\n',t=0;",
    "for(var i in cart){var p=P.items[i];m+='- '+cart[i]+' × '+p.nom+(p.prix!==null?' ('+eur(p.prix*cart[i])+')':'')+'\\n';t+=(p.prix||0)*cart[i]}",
    "if(!Object.keys(cart).length)return;if(t>0)m+='Total : '+eur(t)+'\\n';var note=document.getElementById('cart-note').value.trim();if(note)m+='\\n'+note+'\\n';",
    "if(P.mode==='whatsapp')window.open('https://wa.me/'+P.wa+'?text='+encodeURIComponent(m),'_blank');",
    "else location.href='mailto:'+P.email+'?subject='+encodeURIComponent('Commande sur '+P.site)+'&body='+encodeURIComponent(m)});",
    "draw()})();"
  ].join("\n");

  function render(d, opts) {
    opts = opts || {};
    var t = THEMES[d.theme] || THEMES.moderne;
    var accent = /^#[0-9a-f]{6}$/i.test(d.couleur || "") ? d.couleur : "#0f766e";
    var nom = d.nom || "Mon site";
    var wa = waNumber(d.whatsapp || "");
    var tel = digits(d.telephone) ? String(d.telephone).replace(/[^\d+]/g, "") : "";
    var email = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(String(d.email || "").trim()) ? String(d.email).trim() : "";
    var mode = COMMANDES[d.commande] ? d.commande : "aucune";
    if (mode === "whatsapp" && !wa) mode = email ? "email" : "aucune";
    if (mode === "email" && !email) mode = wa ? "whatsapp" : "aucune";
    var useCart = mode === "whatsapp" || mode === "email";

    // Lien du bouton principal : WhatsApp, puis téléphone, puis e-mail, sinon la section contact.
    var mainHref = "#contact";
    if (wa) mainHref = "https://wa.me/" + wa + "?text=" + encodeURIComponent("Bonjour, je vous contacte depuis votre site " + nom + ".");
    else if (tel) mainHref = "tel:" + tel;
    else if (email) mainHref = "mailto:" + email;
    var items = (d.offre || []).filter(function (o) { return o && String(o.nom || "").trim(); });
    if (items.length && (useCart || mode === "liens")) mainHref = "#offre";
    var ext = /^https?:/.test(mainHref) ? ' target="_blank" rel="noopener"' : "";

    var photo = safeImage(d.photo), logo = safeImage(d.logo);
    var cartItems = [];
    var cards = items.map(function (o, i) {
      var prix = parsePrice(o.prix);
      var img = safeImage(o.photo);
      var btn = "";
      var lien = safeUrl(o.lien);
      if (mode === "liens") {
        btn = lien
          ? '<a class="btn" href="' + esc(lien) + '" target="_blank" rel="noopener">Acheter</a>'
          : '<a class="btn ghost" href="#contact">Nous contacter</a>';
      } else if (useCart) {
        cartItems.push({ nom: String(o.nom), nomHtml: esc(o.nom), prix: prix });
        btn = '<button class="btn" type="button" data-add="' + (cartItems.length - 1) + '">' +
          (prix === null ? "Demander" : "Ajouter au panier") + "</button>";
      }
      return '<article class="item">' + (img ? '<img src="' + img + '" alt="' + esc(o.nom) + '" loading="lazy">' : "") +
        '<div class="in"><h3>' + esc(o.nom) + "</h3>" + (o.desc ? "<p>" + esc(o.desc) + "</p>" : "<p></p>") +
        '<span class="price">' + formatPrice(prix) + "</span>" + btn + "</div></article>";
    }).join("");

    var adresse = String(d.adresse || "").trim();
    var contactList = [];
    if (tel) contactList.push('<li><span class="label">Téléphone</span><a href="tel:' + esc(tel) + '">' + esc(d.telephone) + "</a></li>");
    if (wa) contactList.push('<li><span class="label">WhatsApp</span><a href="https://wa.me/' + wa + '" target="_blank" rel="noopener">Écrire sur WhatsApp</a></li>');
    if (email) contactList.push('<li><span class="label">E-mail</span><a href="mailto:' + esc(email) + '">' + esc(email) + "</a></li>");
    if (adresse) contactList.push('<li><span class="label">Adresse</span>' + esc(adresse) + ' · <a href="https://www.google.com/maps/search/?api=1&amp;query=' +
      encodeURIComponent(adresse) + '" target="_blank" rel="noopener">Itinéraire</a></li>');
    if (d.horaires) contactList.push('<li><span class="label">Horaires</span>' + esc(d.horaires) + "</li>");
    var socials = [];
    var ig = social(d.instagram, "https://www.instagram.com/"), fb = social(d.facebook, "https://www.facebook.com/");
    if (ig) socials.push('<a class="btn ghost" href="' + esc(ig) + '" target="_blank" rel="noopener">Instagram</a>');
    if (fb) socials.push('<a class="btn ghost" href="' + esc(fb) + '" target="_blank" rel="noopener">Facebook</a>');

    var editeur = esc(d.legal_nom || nom) + (d.legal_statut ? ", " + esc(d.legal_statut) : "") +
      (d.siret ? " · SIRET " + esc(d.siret) : "") + (d.legal_adresse || adresse ? " · " + esc(d.legal_adresse || adresse) : "") +
      (email ? " · " + esc(email) : "") + (tel ? " · " + esc(d.telephone) : "");
    var year = opts.year || new Date().getFullYear();
    var creditUrl = safeUrl(opts.creditUrl);

    var html = [
      "<!doctype html>",
      '<html lang="fr"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>" + esc(nom) + (d.slogan ? " – " + esc(d.slogan) : "") + "</title>",
      '<meta name="description" content="' + esc(d.slogan || nom) + '">',
      '<meta property="og:title" content="' + esc(nom) + '">',
      '<meta property="og:description" content="' + esc(d.slogan || "") + '">',
      logo ? '<link rel="icon" href="' + logo + '">' : "",
      "<style>" + css(t, accent) + (photo ? "\n.hero{background-image:url(" + photo + ")}" : "") + "</style>",
      "</head><body" + (tel || wa ? ' class="hasbar"' : "") + ">",
      '<header class="top"><div class="wrap"><a class="brand" href="#">' + (logo ? '<img src="' + logo + '" alt="">' : "") + esc(nom) + "</a>",
      '<nav class="menu"><a href="#apropos">À propos</a>' + (items.length ? '<a href="#offre">' + esc(d.titre_offre || "Nos offres") + "</a>" : "") +
        '<a href="#contact">Contact</a></nav></div></header>',
      '<div class="hero"><div class="wrap"><h1>' + esc(nom) + "</h1>" + (d.slogan ? "<p>" + esc(d.slogan) + "</p>" : "") +
        (d.bouton ? '<a class="btn" href="' + esc(mainHref) + '"' + ext + ">" + esc(d.bouton) + "</a>" : "") + "</div></div>",
      d.apropos ? '<section class="about" id="apropos"><div class="wrap"><h2>À propos</h2><p>' + esc(fill(d.apropos, d)).replace(/\n+/g, "<br><br>") + "</p></div></section>" : "",
      items.length ? '<section class="offer" id="offre"><div class="wrap"><h2>' + esc(d.titre_offre || "Nos offres") + '</h2><div class="grid">' + cards + "</div></div></section>" : "",
      '<section class="contact" id="contact"><div class="wrap"><h2>Contact</h2><div class="cols"><div><ul>' +
        (contactList.join("") || "<li>Ajoutez vos coordonnées dans l'étape Contact.</li>") + "</ul>" +
        (socials.length ? '<div class="socials">' + socials.join("") + "</div>" : "") + "</div>" +
        (adresse ? '<iframe class="map" loading="lazy" title="Plan d\'accès" src="https://www.google.com/maps?q=' + encodeURIComponent(adresse) + '&amp;output=embed"></iframe>' : "") +
        "</div></div></section>",
      '<footer class="bottom"><div class="wrap"><div>© ' + year + " " + esc(nom) + "</div>",
      '<details id="mentions"><summary>Mentions légales</summary><p><strong>Éditeur du site :</strong> ' + editeur + "</p>" +
        "<p><strong>Hébergement :</strong> Netlify, Inc., 512 2nd Street, Fl 2, San Francisco, CA 94107, États-Unis.</p>" +
        "<p><strong>Données personnelles :</strong> ce site n'utilise pas de cookie de mesure d'audience. Les informations que vous envoyez par message ou par e-mail servent uniquement à répondre à votre demande." +
        (adresse ? " Le plan d'accès est fourni par Google Maps, qui peut déposer ses propres cookies." : "") + "</p></details>",
      d.credit !== false && creditUrl ? '<div class="credit">Site créé gratuitement avec <a href="' + esc(creditUrl) + '" target="_blank" rel="noopener">Site Malin</a></div>' : "",
      "</div></footer>",
      tel || wa ? '<div class="mobilebar">' + (tel ? '<a href="tel:' + esc(tel) + '">Appeler</a>' : "") +
        (wa ? '<a href="https://wa.me/' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' : "") + "</div>" : ""
    ];

    if (useCart && cartItems.length) {
      var data = JSON.stringify({ items: cartItems, mode: mode, wa: wa, email: email, site: nom }).replace(/</g, "\\u003c");
      html.push(
        '<button class="btn cart-btn" id="cart-open" type="button" style="display:none">Panier (<span id="cart-count">0</span>)</button>',
        '<div class="cart" id="cart"><div class="panel" role="dialog" aria-label="Panier"><h2 style="text-align:left;margin:0 0 8px">Votre panier</h2>' +
          '<div id="cart-list"></div><div class="total" id="cart-total"></div>' +
          '<textarea id="cart-note" rows="2" placeholder="Votre nom, une précision, une date de retrait…"></textarea>' +
          '<button class="btn" id="cart-send" type="button">Envoyer ma commande ' + (mode === "whatsapp" ? "sur WhatsApp" : "par e-mail") + "</button> " +
          '<button class="btn ghost" id="cart-close" type="button">Continuer</button>' +
          '<p style="font-size:.85rem;color:var(--muted)">Votre commande est envoyée directement à ' + esc(nom) + ", qui vous répond pour confirmer et organiser le paiement.</p></div></div>",
        '<script type="application/json" id="sm-data">' + data + "</script>",
        "<script>" + CART_JS + "</script>"
      );
    }
    html.push("</body></html>");
    return html.filter(Boolean).join("\n");
  }

  var api = { THEMES: THEMES, COMMANDES: COMMANDES, render: render, fromActivity: fromActivity, fill: fill,
    parsePrice: parsePrice, formatPrice: formatPrice, waNumber: waNumber, safeUrl: safeUrl, esc: esc };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SMRender = api;
})(this);
