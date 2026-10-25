// Vérifie que chaque modèle produit un site complet, sans erreur, avec et sans panier.
// Usage : node scripts/check_render.js
var path = require("path");
var R = require(path.join(__dirname, "..", "app", "render.js"));
var acts = require(path.join(__dirname, "..", "app", "activites.json"));
var errors = [];
function check(label, html, must) {
  ["undefined", "NaN", "[object Object]", "{nom}", "{ville"].forEach(function (bad) {
    if (html.indexOf(bad) !== -1) errors.push(label + " : contient « " + bad + " »");
  });
  (must || []).forEach(function (m) { if (html.indexOf(m) === -1) errors.push(label + " : il manque « " + m + " »"); });
}
acts.forEach(function (a) {
  ["id", "nom", "emoji", "theme", "couleur", "exemple", "slogan", "apropos", "titre_offre", "offre", "horaires", "bouton", "pitch", "conseils"]
    .forEach(function (k) { if (!a[k]) errors.push(a.id + " : champ manquant " + k); });
  if (!R.THEMES[a.theme]) errors.push(a.id + " : thème inconnu " + a.theme);
  var d = R.fromActivity(a);
  check(a.id + " (vitrine)", R.render(d, { creditUrl: "https://exemple.github.io/site-malin/" }), ["<h1>", "Mentions légales", "Site Malin"]);
  d.ville = "Nantes"; d.whatsapp = "06 12 34 56 78"; d.email = "a@b.fr"; d.adresse = "1 rue X, Nantes"; d.commande = "whatsapp";
  check(a.id + " (panier WhatsApp)", R.render(d, {}), ["wa.me/33612345678", "cart-send"].concat(a.apropos.indexOf("{ville_a}") !== -1 ? [" à Nantes"] : []));
  d.commande = "email";
  check(a.id + " (panier e-mail)", R.render(d, {}), ["mailto:"]);
  d.commande = "liens"; d.offre[0].lien = "paypal.me/test";
  check(a.id + " (liens)", R.render(d, {}), ["https://paypal.me/test"]);
});
// Sécurité : le texte saisi ne doit jamais pouvoir injecter du code.
var evil = R.fromActivity(acts[0]);
evil.nom = '<script>alert(1)</script>'; evil.offre[0].lien = "javascript:alert(1)"; evil.commande = "liens"; evil.photo = 'x");alert(1);("';
var h = R.render(evil, {});
if (h.indexOf("<script>alert") !== -1 || h.indexOf("javascript:") !== -1 || h.indexOf("alert(1);(") !== -1) errors.push("injection de code possible");
if (R.waNumber("+33 6 12 34 56 78") !== "33612345678" || R.waNumber("0612345678") !== "33612345678") errors.push("numéro WhatsApp mal converti");
if (R.formatPrice(R.parsePrice("1,30")) !== "1,30 €" || R.formatPrice(R.parsePrice("")) !== "Sur devis") errors.push("format des prix incorrect");
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("OK : " + acts.length + " modèles vérifiés");
