# Site Malin

Créateur de site internet **gratuit et sans inscription** : l'utilisateur choisit son activité, personnalise ses textes, couleurs, photos et produits, puis télécharge son site et le publie gratuitement sur Netlify Drop. Tout se passe dans le navigateur, sans serveur.

Le site lui-même est **hébergé gratuitement sur GitHub Pages** et **s'enrichit automatiquement** : deux fois par semaine, un robot (GitHub Actions + Google Gemini, version gratuite) écrit un guide pratique et le publie, pour attirer des visiteurs depuis Google.

## Fonctionnement

| Élément | Rôle |
|---|---|
| `app/activites.json` | Les modèles par activité (textes, produits d'exemple, couleurs, conseils) |
| `app/render.js` | Fabrique le site de l'utilisateur : un seul fichier HTML, avec panier WhatsApp / e-mail |
| `app/builder.*` | L'assistant de création, étape par étape, avec aperçu en direct |
| `guides/<slug>/` | Un dossier par guide : `meta.json` et `article.html` |
| `guides/backlog.json` | Les sujets de guides à écrire. Quand la liste est vide, Gemini en propose de nouveaux |
| `scripts/generate.py` | Le robot : écrit un guide avec Gemini, le vérifie, l'ajoute |
| `scripts/check_render.js` | Teste chaque modèle (site complet, panier, sécurité des saisies) avant publication |
| `scripts/build.py` | Construit le site (accueil, assistant, modèles, guides, sitemap…) dans `_site/` |
| `.github/workflows/site.yml` | Lance tout : à chaque modification, et le mardi et le vendredi à 6 h UTC |
| `config.json` | Nom du site, codes Search Console / AdSense / GoatCounter, blocs d'affiliation |

## Réglages à faire une seule fois

1. **Activer GitHub Pages** : Settings → Pages → Source : **GitHub Actions**.
2. **Clé Gemini** : Settings → Secrets and variables → Actions → New repository secret, nom `GEMINI_API_KEY` (la même clé gratuite que pour Calculs Malins convient).
3. Facultatif : publier un guide tout de suite avec Actions → « Générer et publier le site » → Run workflow.

## Monétisation

- **Affiliation** : le bloc `domaine` de `affiliate_blocks` (o2switch via Awin) s'affiche à l'étape de publication, sur les pages modèles et les guides. Il faut être accepté dans le programme o2switch sur Awin pour toucher les commissions.
- **Lien « Site créé avec Site Malin »** en bas des sites créés (l'utilisateur peut le retirer) : il amène des visiteurs.
- **Google AdSense** : plus tard, mettre l'identifiant `ca-pub-…` dans `adsense_client`. Les pubs apparaissent sur les guides et les modèles, jamais dans les sites des utilisateurs.

## Tester en local

```
node scripts/check_render.js && python3 scripts/build.py && cd _site && python3 -m http.server
```
