#!/usr/bin/env python3
"""Construit le site statique dans _site/ : accueil, assistant de création, modèles, guides, pages légales."""
import hashlib
import html
import json
import os
import shutil
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
GUIDES = ROOT / "guides"
OUT = ROOT / "_site"


def load_config():
    cfg = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    cfg["site_url"] = os.environ.get("SITE_URL", cfg.get("site_url", "")).rstrip("/")
    base = os.environ.get("BASE_PATH", cfg.get("base_path", "")).strip("/")
    cfg["base_path"] = f"/{base}/" if base else "/"
    return cfg


def load_activities():
    return json.loads((APP / "activites.json").read_text(encoding="utf-8"))


def load_guides():
    guides = []
    for meta_file in sorted(GUIDES.glob("*/meta.json")):
        g = json.loads(meta_file.read_text(encoding="utf-8"))
        g["slug"] = meta_file.parent.name
        g["html"] = (meta_file.parent / "article.html").read_text(encoding="utf-8")
        guides.append(g)
    guides.sort(key=lambda g: g.get("date", ""), reverse=True)
    return guides


def esc(s):
    return html.escape(str(s), quote=True)


def asset(cfg, name):
    """Lien vers un fichier de assets/ avec un numéro de version, pour que les navigateurs prennent la dernière version."""
    v = hashlib.md5((OUT / "assets" / name).read_bytes()).hexdigest()[:8]
    return f'{cfg["base_path"]}assets/{name}?v={v}'


def layout(cfg, *, title, description, path, body, extra_head="", main_class="wrap"):
    b = cfg["base_path"]
    canonical = f'{cfg["site_url"]}{b}{path}' if cfg["site_url"] else ""
    head = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f"<title>{esc(title)}</title>",
        f'<meta name="description" content="{esc(description)}">',
        f'<link rel="stylesheet" href="{asset(cfg, "style.css")}">',
        f'<link rel="icon" href="{b}assets/favicon.svg" type="image/svg+xml">',
        f'<meta property="og:title" content="{esc(title)}">',
        f'<meta property="og:description" content="{esc(description)}">',
        '<meta property="og:type" content="website">',
    ]
    if canonical:
        head.append(f'<link rel="canonical" href="{esc(canonical)}">')
        head.append(f'<meta property="og:url" content="{esc(canonical)}">')
    if cfg.get("google_site_verification"):
        head.append(f'<meta name="google-site-verification" content="{esc(cfg["google_site_verification"])}">')
    if cfg.get("adsense_client"):
        head.append(
            '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
            f'?client={esc(cfg["adsense_client"])}" crossorigin="anonymous"></script>'
        )
    if cfg.get("goatcounter_code"):
        head.append(
            f'<script data-goatcounter="https://{esc(cfg["goatcounter_code"])}.goatcounter.com/count" '
            'async src="//gc.zgo.at/count.js"></script>'
        )
    year = date.today().year
    return f"""<!doctype html>
<html lang="{cfg['lang']}">
<head>
{chr(10).join(head)}
{extra_head}
</head>
<body>
<header class="site-header">
  <div class="wrap wide">
    <a class="brand" href="{b}"><span class="logo">S</span> {esc(cfg['site_name'])}</a>
    <nav><a href="{b}modeles/">Modèles</a><a href="{b}guides/">Guides</a><a class="nav-cta" href="{b}creer/">Créer mon site</a></nav>
  </div>
</header>
<main class="{main_class}">
{body}
</main>
<footer class="site-footer">
  <div class="wrap wide">
    <p>© {year} {esc(cfg['site_name'])} · Créateur de site gratuit, sans inscription.</p>
    <p><a href="{b}mentions-legales/">Mentions légales</a> · <a href="{b}confidentialite/">Confidentialité</a></p>
  </div>
</footer>
</body>
</html>
"""


def ad_slot(cfg):
    if not cfg.get("adsense_client"):
        return ""
    return (
        '<div class="ad"><ins class="adsbygoogle" style="display:block" '
        f'data-ad-client="{esc(cfg["adsense_client"])}" data-ad-format="auto" '
        'data-full-width-responsive="true"></ins>'
        "<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>"
    )


def affiliate(cfg, key="domaine"):
    block = cfg.get("affiliate_blocks", {}).get(key, "")
    return f'<aside class="affiliate">{block}</aside>' if block else ""


def model_card(cfg, a):
    return (
        f'<a class="card" href="{cfg["base_path"]}modeles/{a["id"]}/">'
        f'<span class="card-emoji">{a["emoji"]}</span>'
        f'<strong>Site {esc(a["nom"].lower())}</strong><span>{esc(a["slogan"])}</span></a>'
    )


def guide_card(cfg, g):
    return (
        f'<a class="card" href="{cfg["base_path"]}guides/{g["slug"]}/">'
        f'<span class="card-emoji">{esc(g.get("emoji", "📘"))}</span>'
        f'<strong>{esc(g["title"])}</strong><span>{esc(g["description"])}</span></a>'
    )


def faq_block(faq):
    if not faq:
        return "", ""
    items = "".join(f"<details><summary>{esc(q['q'])}</summary><p>{esc(q['a'])}</p></details>" for q in faq)
    ld = {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q["q"], "acceptedAnswer": {"@type": "Answer", "text": q["a"]}} for q in faq],
    }
    return (f'<section class="faq"><h2>Questions fréquentes</h2>{items}</section>',
            f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>')


HOME_FAQ = [
    {"q": "Est-ce vraiment gratuit ?", "a": "Oui. Créer le site est gratuit, sans inscription et sans carte bancaire. L'hébergement sur Netlify est lui aussi gratuit pour un site comme le vôtre. Seul un nom de domaine personnalisé (votre-nom.fr) est payant, et il est facultatif."},
    {"q": "Faut-il savoir coder ?", "a": "Non. Vous répondez à quelques questions, vous ajoutez vos photos et vos prix, et le site se construit sous vos yeux. Pour le mettre en ligne, il suffit de glisser un fichier sur une page web."},
    {"q": "Peut-on vendre en ligne ?", "a": "Oui, simplement : vos clients remplissent un panier et la commande vous arrive sur WhatsApp ou par e-mail. Vous pouvez aussi coller un lien de paiement PayPal, Stripe ou SumUp sur chaque produit."},
    {"q": "Où sont stockées mes informations ?", "a": "Uniquement dans votre navigateur, pendant que vous créez votre site. Rien n'est envoyé sur nos serveurs. Pensez à enregistrer votre projet pour pouvoir le modifier plus tard."},
    {"q": "Quelle est la différence avec Shopify ou Wix ?", "a": "Ces services sont très complets mais payants chaque mois dès qu'on veut un vrai site. Site Malin vise l'essentiel : un beau site, rapide et gratuit, pour les petites activités qui veulent exister en ligne sans abonnement."},
]


def render_index(cfg, acts, guides):
    b = cfg["base_path"]
    faq_html, faq_ld = faq_block(HOME_FAQ)
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": cfg["site_name"],
          "description": cfg["description"], "applicationCategory": "BusinessApplication", "operatingSystem": "Tous",
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"}}
    body = f"""
<section class="landing">
  <h1>{esc(cfg['tagline'])}</h1>
  <p>Site vitrine ou petite boutique : répondez à quelques questions, ajoutez vos photos et vos prix, et mettez votre site en ligne. Sans inscription, sans abonnement, sans savoir coder.</p>
  <a class="cta" href="{b}creer/">Créer mon site gratuitement →</a>
  <p class="reassure">✓ 100 % gratuit · ✓ Sans inscription · ✓ Prêt en 5 minutes</p>
</section>
<section><h2>Comment ça marche</h2>
<div class="how">
  <div><strong>Choisissez votre activité</strong><span>Restaurant, coiffeur, artisan, boutique… Un modèle avec des textes déjà rédigés s'adapte à vous.</span></div>
  <div><strong>Personnalisez</strong><span>Votre nom, vos couleurs, vos photos, vos produits et vos prix. L'aperçu change en direct.</span></div>
  <div><strong>Publiez</strong><span>Téléchargez votre site et glissez-le sur Netlify, un hébergeur gratuit. Nous vous guidons à chaque clic.</span></div>
</div></section>
<section><h2>Tout ce qu'il faut, rien de compliqué</h2>
<ul class="features">
  <li>Un site joli sur ordinateur et sur téléphone</li>
  <li>Vos produits ou services avec leurs prix</li>
  <li>Un panier : les commandes arrivent sur WhatsApp ou par e-mail</li>
  <li>Des boutons de paiement PayPal, Stripe ou SumUp</li>
  <li>Boutons « Appeler » et « WhatsApp » toujours visibles sur mobile</li>
  <li>Plan d'accès Google Maps et horaires</li>
  <li>Mentions légales rédigées pour vous</li>
  <li>Un site ultra-rapide, sans publicité sur votre site</li>
</ul></section>
<section id="modeles"><h2>Un modèle pour chaque activité</h2><div class="grid">{''.join(model_card(cfg, a) for a in acts)}</div></section>
{f'<section><h2>Derniers guides</h2><div class="grid">{"".join(guide_card(cfg, g) for g in guides[:6])}</div></section>' if guides else ''}
{faq_html}
<p class="center"><a class="cta" href="{b}creer/">Je crée mon site →</a></p>
"""
    extra = f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>{faq_ld}'
    return layout(cfg, title=f"Créer un site internet gratuit en 5 minutes – {cfg['site_name']}",
                  description=cfg["description"], path="", body=body, extra_head=extra, main_class="wrap wide")


def render_builder(cfg, acts):
    builder_cfg = {
        "creditUrl": (cfg["site_url"] + cfg["base_path"]) if cfg["site_url"] else "",
        "affiliateHtml": cfg.get("affiliate_blocks", {}).get("domaine", ""),
    }
    data = json.dumps(builder_cfg, ensure_ascii=False).replace("</", "<\\/")
    body = (APP / "builder.html").read_text(encoding="utf-8")
    body += f'\n<script>window.SM_CONFIG = {data};</script>'
    body += f'\n<script src="{asset(cfg, "activites.js")}"></script>'
    body += f'\n<script src="{asset(cfg, "render.js")}"></script>'
    body += f'\n<script src="{asset(cfg, "builder.js")}"></script>'
    extra = f'<link rel="stylesheet" href="{asset(cfg, "builder.css")}"><meta name="robots" content="noindex">'
    return layout(cfg, title=f"Créer mon site – {cfg['site_name']}",
                  description="Créez votre site gratuitement, étape par étape, avec un aperçu en direct.",
                  path="creer/", body=body, extra_head=extra, main_class="app")


def render_model(cfg, a, acts, guides):
    b = cfg["base_path"]
    others = [x for x in acts if x["id"] != a["id"]][:4]
    conseils = "".join(f"<li>{esc(c)}</li>" for c in a.get("conseils", []))
    offre = "".join(f"<li>{esc(o['nom'])}{' : ' + esc(o['desc']) if o.get('desc') else ''}</li>" for o in a["offre"])
    title = f"Créer un site {a['nom'].lower()} gratuit"
    desc = f"Créez gratuitement le site de votre activité ({a['nom'].lower()}) : modèle prêt à l'emploi, textes rédigés, prix, contact et mise en ligne guidée."
    body = f"""
<nav class="crumbs"><a href="{b}">Accueil</a> › <a href="{b}modeles/">Modèles</a> › {esc(a['nom'])}</nav>
<h1>{a['emoji']} {esc(title)}</h1>
<p class="lead">{esc(a['pitch'])}</p>
<p class="center"><a class="cta" href="{b}creer/?modele={a['id']}">Utiliser ce modèle gratuitement →</a></p>
<h2>Aperçu du modèle</h2>
<iframe class="model-preview" id="model-preview" title="Aperçu du modèle {esc(a['nom'])}" sandbox="allow-scripts" loading="lazy"></iframe>
<article class="guide">
<h2>Ce que contient votre site</h2>
<ul><li>Une page d'accueil avec votre nom, votre accroche et un bouton « {esc(a['bouton'])} »</li>
<li>Une présentation de votre activité, déjà rédigée et modifiable</li>
<li>Une section « {esc(a['titre_offre'])} » avec vos prix, par exemple : <ul>{offre}</ul></li>
<li>Vos horaires, vos coordonnées, un plan d'accès et vos réseaux sociaux</li>
<li>Des mentions légales générées pour vous</li></ul>
<h2>Nos conseils pour un site qui attire des clients</h2>
<ul>{conseils}</ul>
</article>
{affiliate(cfg)}
{ad_slot(cfg)}
<p class="center"><a class="cta" href="{b}creer/?modele={a['id']}">Créer mon site maintenant →</a></p>
<section class="related"><h2>Autres modèles</h2><div class="grid">{''.join(model_card(cfg, x) for x in others)}</div></section>
<script src="{asset(cfg, 'render.js')}"></script>
<script>
(function(){{
  var a = {json.dumps(a, ensure_ascii=False).replace('</', '<\\/')};
  var d = SMRender.fromActivity(a);
  d.ville = "Votre ville";
  d.telephone = "01 23 45 67 89";
  d.adresse = "";
  document.getElementById("model-preview").srcdoc = SMRender.render(d, {{}});
}})();
</script>
"""
    return layout(cfg, title=f"{title} – {cfg['site_name']}", description=desc, path=f"modeles/{a['id']}/", body=body)


def render_models_index(cfg, acts):
    body = f"""
<h1>Modèles de sites gratuits</h1>
<p class="lead">Choisissez le modèle qui correspond à votre activité : les textes, les sections et les boutons sont déjà prêts. Il ne reste qu'à mettre vos informations.</p>
<div class="grid">{''.join(model_card(cfg, a) for a in acts)}</div>
"""
    return layout(cfg, title=f"Modèles de sites gratuits par activité – {cfg['site_name']}",
                  description="Modèles de sites internet gratuits pour restaurants, coiffeurs, artisans, boutiques, coachs, associations et plus.",
                  path="modeles/", body=body)


def render_guide(cfg, g, guides, acts):
    b = cfg["base_path"]
    faq_html, faq_ld = faq_block(g.get("faq", []))
    related = [x for x in guides if x["slug"] != g["slug"]][:4]
    act = next((a for a in acts if a["id"] == g.get("activite")), None)
    cta_href = f"{b}creer/?modele={act['id']}" if act else f"{b}creer/"
    ld = {"@context": "https://schema.org", "@type": "Article", "headline": g["title"],
          "description": g["description"], "datePublished": g.get("date", ""),
          "author": {"@type": "Organization", "name": cfg["site_name"]}}
    body = f"""
<nav class="crumbs"><a href="{b}">Accueil</a> › <a href="{b}guides/">Guides</a></nav>
<h1>{esc(g.get('emoji', '📘'))} {esc(g['title'])}</h1>
<p class="lead">{esc(g['description'])}</p>
<aside class="affiliate"><strong>Créez votre site gratuitement, en 5 minutes</strong><p>Sans inscription, avec un modèle prêt à l'emploi{' pour votre activité (' + esc(act['nom'].lower()) + ')' if act else ''}.</p><a class="aff-btn" href="{cta_href}">Créer mon site →</a></aside>
<article class="guide">
{g['html']}
</article>
{affiliate(cfg)}
{ad_slot(cfg)}
{faq_html}
{f'<section class="related"><h2>À lire aussi</h2><div class="grid">{"".join(guide_card(cfg, x) for x in related)}</div></section>' if related else ''}
<p class="updated">Publié le {esc(g.get('date', ''))}</p>
"""
    return layout(cfg, title=f"{g['title']} – {cfg['site_name']}", description=g["description"],
                  path=f"guides/{g['slug']}/", body=body,
                  extra_head=f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>{faq_ld}')


def render_guides_index(cfg, guides):
    body = f"""
<h1>Guides pour créer et faire connaître votre site</h1>
<p class="lead">Conseils pratiques, gratuits et sans jargon pour les commerçants, artisans, indépendants et associations.</p>
<div class="grid">{''.join(guide_card(cfg, g) for g in guides) or '<p>Les premiers guides arrivent très bientôt.</p>'}</div>
"""
    return layout(cfg, title=f"Guides pour créer son site internet – {cfg['site_name']}",
                  description="Guides gratuits pour créer, publier et faire connaître le site internet de votre activité.",
                  path="guides/", body=body)


def render_page(cfg, slug, title, inner):
    return layout(cfg, title=f"{title} – {cfg['site_name']}", description=title, path=f"{slug}/",
                  body=f'<article class="guide"><h1>{esc(title)}</h1>{inner}</article>')


def legal_pages(cfg):
    owner = esc(cfg.get("owner_name") or "le propriétaire du site")
    contact = esc(cfg.get("contact_email") or "via la page GitHub du projet")
    mentions = f"""
<p><strong>Éditeur :</strong> {owner}, particulier. Contact : {contact}.</p>
<p><strong>Hébergement :</strong> GitHub Pages, GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.</p>
<p>Site Malin est un outil gratuit qui aide à créer un site internet. Chaque utilisateur est seul éditeur et responsable du site qu'il crée et publie,
y compris de ses textes, images, prix et mentions légales. Les modèles de textes sont fournis à titre d'exemple.</p>
<p>Les guides sont rédigés en partie avec l'aide d'outils d'intelligence artificielle puis publiés automatiquement. Ils sont donnés à titre informatif
et ne remplacent pas l'avis d'un professionnel : vérifiez les règles officielles sur service-public.fr.</p>
<p>Certains liens sont des liens d'affiliation : le site peut percevoir une commission, sans surcoût pour vous.</p>
"""
    privacy = """
<p>Le créateur de site fonctionne entièrement dans votre navigateur : les textes, photos et coordonnées que vous saisissez ne sont pas envoyés à nos serveurs.
Un brouillon est gardé dans la mémoire de votre navigateur (stockage local) pour que vous ne perdiez pas votre travail. Vous pouvez l'effacer en vidant les données du site dans votre navigateur.</p>
<p>Lorsque vous publiez votre site sur Netlify ou un autre hébergeur, ce sont les conditions de cet hébergeur qui s'appliquent.</p>
<p>Le site peut utiliser une mesure d'audience respectueuse de la vie privée (sans cookie) et, le cas échéant, des publicités fournies par Google AdSense,
qui peut déposer des cookies. Vous pouvez gérer vos préférences publicitaires sur <a href="https://adssettings.google.com">adssettings.google.com</a>.</p>
"""
    return {
        "mentions-legales": ("Mentions légales", mentions),
        "confidentialite": ("Politique de confidentialité", privacy),
    }


def main():
    cfg = load_config()
    acts = load_activities()
    guides = load_guides()
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(ROOT / "assets", OUT / "assets")
    for name in ("render.js", "builder.js", "builder.css"):
        shutil.copy(APP / name, OUT / "assets" / name)
    (OUT / "assets" / "activites.js").write_text(
        "window.SM_ACTIVITES = " + json.dumps(acts, ensure_ascii=False) + ";\n", encoding="utf-8")
    if (ROOT / "static").exists():
        shutil.copytree(ROOT / "static", OUT, dirs_exist_ok=True)

    pages = {"": render_index(cfg, acts, guides), "creer/": render_builder(cfg, acts),
             "modeles/": render_models_index(cfg, acts), "guides/": render_guides_index(cfg, guides)}
    for a in acts:
        pages[f"modeles/{a['id']}/"] = render_model(cfg, a, acts, guides)
    for g in guides:
        pages[f"guides/{g['slug']}/"] = render_guide(cfg, g, guides, acts)
    for slug, (title, inner) in legal_pages(cfg).items():
        pages[f"{slug}/"] = render_page(cfg, slug, title, inner)
    for path, content in pages.items():
        p = OUT / path
        p.mkdir(parents=True, exist_ok=True)
        (p / "index.html").write_text(content, encoding="utf-8")
    (OUT / "404.html").write_text(
        render_page(cfg, "404", "Page introuvable", f'<p><a href="{cfg["base_path"]}">Retour à l\'accueil</a></p>'),
        encoding="utf-8")

    if cfg["site_url"]:
        base = cfg["site_url"] + cfg["base_path"]
        today = date.today().isoformat()
        dates = {f"guides/{g['slug']}/": g.get("date", today) for g in guides}
        urls = [p for p in pages if p != "creer/"]
        sm = "".join(f"<url><loc>{esc(base + p)}</loc><lastmod>{dates.get(p, today)}</lastmod></url>" for p in urls)
        (OUT / "sitemap.xml").write_text(
            f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>',
            encoding="utf-8")
        (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {base}sitemap.xml\n", encoding="utf-8")
    if cfg.get("adsense_client"):
        pub = cfg["adsense_client"].replace("ca-", "")
        (OUT / "ads.txt").write_text(f"google.com, {pub}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")
    (OUT / ".nojekyll").write_text("", encoding="utf-8")
    print(f"Site construit : {len(acts)} modèles, {len(guides)} guides -> {OUT}")


if __name__ == "__main__":
    main()
