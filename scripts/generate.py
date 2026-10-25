#!/usr/bin/env python3
"""Robot de publication : écrit un nouveau guide avec Gemini à partir de guides/backlog.json.

Variables d'environnement :
  GEMINI_API_KEY  clé gratuite créée sur https://aistudio.google.com/apikey (obligatoire)
  GEMINI_MODEL    modèle à utiliser (facultatif)
  COUNT           nombre de guides à écrire pendant ce passage (défaut : 1)
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GUIDES = ROOT / "guides"
BACKLOG = GUIDES / "backlog.json"
API_ROOT = "https://generativelanguage.googleapis.com/v1beta"
API = API_ROOT + "/models/{model}:generateContent"
_models = None


def models():
    """Modèles à essayer : celui imposé, l'alias « dernier Flash », puis les Flash disponibles, du plus récent au plus ancien."""
    global _models
    if _models is None:
        found = []
        try:
            req = urllib.request.Request(API_ROOT + "/models?pageSize=1000",
                                         headers={"x-goog-api-key": os.environ.get("GEMINI_API_KEY", "")})
            with urllib.request.urlopen(req, timeout=60) as r:
                for m in json.load(r).get("models", []):
                    name = m["name"].split("/", 1)[-1]
                    if ("generateContent" in m.get("supportedGenerationMethods", []) and "flash" in name
                            and not re.search(r"lite|image|tts|audio|live|thinking|exp", name)):
                        found.append(name)
        except (OSError, KeyError, json.JSONDecodeError) as e:
            print("Liste des modèles indisponible :", e)

        def version(n):
            return [int(x) for x in re.findall(r"\d+", n)] + [0 if "preview" in n else 1]
        found.sort(key=version, reverse=True)
        _models = [m for m in [os.environ.get("GEMINI_MODEL"), "gemini-flash-latest"] if m] + found
        print("Modèles candidats :", ", ".join(_models[:5]))
    return _models


def gemini(prompt, schema=None):
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY manquante : ajoutez-la dans Settings > Secrets and variables > Actions.")
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "responseMimeType": "application/json"},
    }
    if schema:
        body["generationConfig"]["responseSchema"] = schema
    last = None
    for model in models():
        for attempt in range(3):
            req = urllib.request.Request(
                API.format(model=model), data=json.dumps(body).encode(),
                headers={"Content-Type": "application/json", "x-goog-api-key": key})
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    data = json.load(r)
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(text)
            except urllib.error.HTTPError as e:
                last = f"{model}: HTTP {e.code} {e.read()[:300]!r}"
                if e.code in (400, 404):
                    break  # modèle indisponible : on passe au suivant
                time.sleep(20 * (attempt + 1))
            except (KeyError, IndexError, json.JSONDecodeError, OSError) as e:  # OSError couvre aussi les délais dépassés
                last = f"{model}: {e}"
                time.sleep(5)
    raise RuntimeError(f"Gemini n'a pas répondu correctement ({last})")


GUIDE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING"},
        "description": {"type": "STRING"},
        "emoji": {"type": "STRING"},
        "article_html": {"type": "STRING"},
        "faq": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "q": {"type": "STRING"}, "a": {"type": "STRING"}}, "required": ["q", "a"]}},
    },
    "required": ["title", "description", "emoji", "article_html", "faq"],
}


def guide_prompt(item, activities, feedback):
    act = next((a for a in activities if a["id"] == item.get("activite")), None)
    return f"""Tu es rédacteur web expert en création de sites internet pour les petites entreprises françaises.
Écris un guide pratique pour le site français "Site Malin", un créateur de site gratuit et sans inscription
(modèles par activité, panier dont les commandes arrivent sur WhatsApp ou par e-mail, liens de paiement PayPal/Stripe/SumUp,
mentions légales générées, mise en ligne gratuite en glissant un fichier sur Netlify Drop).

Sujet : {item['title']}
Notes : {item.get('notes', '')}
{f"Activité concernée : {act['nom']}. Le lecteur pourra utiliser notre modèle prêt à l'emploi pour cette activité." if act else ""}

Contraintes STRICTES :
- article_html : 700 à 1200 mots en HTML simple (h2, h3, p, ul, ol, li, strong, table), sans h1, sans lien, sans script ni style.
  Ton concret et chaleureux, vouvoiement, phrases courtes, étapes numérotées quand c'est utile, un exemple concret.
  Parle de Site Malin naturellement une ou deux fois comme solution gratuite, sans exagérer ni dénigrer les concurrents.
- Les règles légales et les prix doivent être exacts pour la France. Si un montant ou une règle peut changer,
  dis de vérifier sur le site officiel (service-public.fr, entreprendre.service-public.fr, cnil.fr). N'invente aucun chiffre ni aucune statistique.
- faq : 3 à 5 questions-réponses courtes que les gens tapent vraiment sur Google.
- title : titre SEO de moins de 65 caractères. description : phrase de 120 à 155 caractères. emoji : un seul emoji.
{f"ATTENTION, ta tentative précédente a été refusée pour cette raison : {feedback}. Corrige ce problème." if feedback else ""}
Réponds uniquement avec l'objet JSON demandé."""


FORBIDDEN_HTML = re.compile(r"<script|<iframe|<object|<embed|<style|<link|<a\s|<img|<form|\son\w+\s*=|javascript:", re.I)


def validate(res):
    bad = FORBIDDEN_HTML.search(res["article_html"])
    if bad:
        return f"article_html contient du code interdit : {bad.group(0)}"
    if "<h1" in res["article_html"].lower():
        return "article_html ne doit pas contenir de h1"
    words = len(re.sub(r"<[^>]+>", " ", res["article_html"]).split())
    if words < 550:
        return f"article_html est trop court ({words} mots, au moins 700 demandés)"
    if not 3 <= len(res["faq"]) <= 6:
        return "la faq doit contenir 3 à 5 questions"
    if len(res["title"]) > 80:
        return "le titre est trop long"
    return None


def write_guide(item, res):
    d = GUIDES / item["slug"]
    d.mkdir(parents=True, exist_ok=True)
    meta = {
        "title": res["title"].strip(),
        "description": res["description"].strip(),
        "emoji": res["emoji"].strip()[:4] or "📘",
        "date": date.today().isoformat(),
        "generated": True,
        "faq": res["faq"],
    }
    if item.get("activite"):
        meta["activite"] = item["activite"]
    (d / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (d / "article.html").write_text(res["article_html"].strip() + "\n", encoding="utf-8")


def refill_backlog(backlog, activities):
    """Quand la liste d'idées est vide, Gemini en propose de nouvelles."""
    existing = sorted(p.name for p in GUIDES.iterdir() if p.is_dir())
    prompt = f"""Propose 15 sujets de guides pratiques très recherchés sur Google par des commerçants, artisans, indépendants
et associations en France qui veulent créer, publier, faire connaître ou rentabiliser leur site internet.
Mélange des guides par métier (activités possibles : {', '.join(a['id'] + ' = ' + a['nom'] for a in activities)})
et des guides généraux (référencement local, mentions légales, vendre en ligne, nom de domaine, photos, réseaux sociaux…).
Guides déjà publiés (à ne pas répéter) : {', '.join(existing)}.
Pour chacun : slug (minuscules, tirets, sans accent), title, activite (un id de la liste ou chaîne vide), notes (angle et points clés)."""
    schema = {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "slug": {"type": "STRING"}, "title": {"type": "STRING"},
        "activite": {"type": "STRING"}, "notes": {"type": "STRING"}},
        "required": ["slug", "title", "activite", "notes"]}}
    ids = {a["id"] for a in activities}
    for i in gemini(prompt, schema):
        i["slug"] = re.sub(r"[^a-z0-9-]", "", i["slug"].lower())[:70]
        if i.get("activite") not in ids:
            i.pop("activite", None)
        if i["slug"] and i["slug"] not in existing:
            backlog.append(i)
    print(f"Backlog rechargé : {len(backlog)} idées")


def main():
    activities = json.loads((ROOT / "app" / "activites.json").read_text(encoding="utf-8"))
    backlog = json.loads(BACKLOG.read_text(encoding="utf-8"))
    created = 0
    for _ in range(int(os.environ.get("COUNT", "1"))):
        if not backlog:
            refill_backlog(backlog, activities)
        while backlog:
            item = backlog.pop(0)
            if (GUIDES / item["slug"]).exists():
                continue
            feedback = None
            for attempt in range(3):
                print(f"→ {item['title']} (essai {attempt + 1})")
                try:
                    res = gemini(guide_prompt(item, activities, feedback), GUIDE_SCHEMA)
                except RuntimeError as e:
                    print(e)
                    sys.exit(1)
                feedback = validate(res)
                if feedback:
                    print("  refusé :", feedback)
                    continue
                write_guide(item, res)
                print(f"  publié : guides/{item['slug']}")
                created += 1
                break
            else:
                print(f"  abandonné après 3 essais : {item['slug']}")
                item["failed"] = item.get("failed", 0) + 1
                if item["failed"] < 2:
                    backlog.append(item)  # on retentera plus tard
                continue
            break
    BACKLOG.write_text(json.dumps(backlog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{created} guide(s) écrit(s)")


if __name__ == "__main__":
    main()
