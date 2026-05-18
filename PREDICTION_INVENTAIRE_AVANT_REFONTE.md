# Inventaire complet — Interface Prédiction (état actuel avant refonte)

> Objectif : lister **exhaustivement** ce que l'interface affiche, les types, les calculs et les endpoints,
> pour décider précisément ce qu'on garde / vire / améliore dans la refonte.

---

## 🗄️ 1. Modèle de données BDD (PostgreSQL)

### Table `prediction_runs` — un run = un clic sur "Lancer la prédiction"

| Champ | Type | Nullable | Description |
|---|---|---|---|
| `id_run` | INT PK | non | identifiant auto-incrémenté |
| `id_modele` | INT FK → `modeles_ml` | non | quel modèle a été utilisé |
| `id_user` | INT FK → `utilisateurs` | non | qui a lancé le run |
| `pole` | VARCHAR(100) | oui | filtre pôle (NULL si ADMIN sans filtre) |
| `statut` | ENUM | non | `EN_COURS` / `TERMINE` / `ERREUR` |
| `nb_composants` | INT | oui | nb de composants analysés (33 max) |
| `nb_critiques` | INT | oui | parmi la **dernière** prédiction de chaque comp, ceux avec statut CRITIQUE |
| `nb_urgents` | INT | oui | idem statut URGENT |
| `nb_surveillance` | INT | oui | idem statut SURVEILLANCE |
| `nb_ok` | INT | oui | idem statut OK |
| `duree_ms` | INT | oui | durée d'exécution en millisecondes |
| `erreur_message` | TEXT | oui | message d'erreur si statut=ERREUR |
| `launched_at` | DATETIME | non | date/heure de lancement |
| `finished_at` | DATETIME | oui | date/heure de fin |

### Table `prediction_resultats` — une ligne = une prédiction (un composant, un mois)

| Champ | Type | Nullable | Description |
|---|---|---|---|
| `id_resultat` | INT PK | non | auto-incrémenté |
| `id_run` | INT FK → `prediction_runs` | non | run parent |
| `ref_date` | DATE | oui | **date de référence** = la date à laquelle on a interrogé le modèle (= 1 par mois sur la période historique) |
| `equipment_code` | VARCHAR(100) | non | code SAP du composant (ex `BCH04-CHARIO-01`) |
| `equipment_desc` | VARCHAR(255) | oui | description (snapshot au moment du run) |
| `system_equipment` | VARCHAR(100) | oui | machine racine SAP (ex `B7286T0005`) |
| `pole` | VARCHAR(100) | oui | pôle (snapshot) |
| `zone` | VARCHAR(200) | oui | zone (snapshot) |
| `comp_level` | INT | oui | niveau hiérarchique (3 ou 4) |
| `rul_jours` | INT | non | **RUL prédit en jours** (0-30, clippé par max_rul) |
| `statut` | ENUM | non | `CRITIQUE` / `URGENT` / `SURVEILLANCE` / `OK` |
| `date_panne_prevue` | DATE | oui | = `ref_date + rul_jours` jours |
| `confiance_pct` | INT | oui | 70-94 % (calculé heuristiquement) |
| `source` | ENUM | non | `ML` ou `SIMULATION` (fallback) |
| `stock_disponible` | INT | oui | qté totale en stock pour ce composant (au moment du run) |
| `alerte_stock` | VARCHAR(10) | oui | `OK` / `FAIBLE` / `ABSENT` / NULL |

### Table `modeles_ml` (existant — non touché par cette refonte)
- `id_modele`, `version`, `type_modele` (`LSTM`/`GRU`), `nom`, `path_keras`, `path_scaler_x`, `path_scaler_y`, `is_active`, `uploaded_at`

---

## 🌐 2. Endpoints REST exposés (`backend/routes/predictions.py`)

| Méthode | URL | Description | Réponse |
|---|---|---|---|
| POST | `/predictions/run` | Lance un run mensuel sur les 33 composants test du pôle | Détails du run + dernières prédictions par comp |
| GET | `/predictions/historique?limit=20` | Liste des runs passés (filtré par pôle pour méthodiste) | `PredictionRunSummary[]` |
| GET | `/predictions/runs/{id_run}` | Détail complet d'un run avec **toutes** ses prédictions | `PredictionRunRead` |
| GET | `/predictions/composant/{code}/detail` | Fiche complète d'un composant | KPIs + dernière pred + historique pannes + stock + machine racine |
| GET | `/predictions/modele-actif` | Info sur le modèle actuellement actif | version, R², MAE, lookback, max_rul, num_composants |
| GET | `/predictions/comparaison-modeles` | Compare le dernier run LSTM avec le dernier run GRU pour le pôle | Par composant : `lstm` vs `gru`, écart RUL, accord statut |
| POST | `/predictions/composant/{code}/generer-ot` | Crée un OT prédictif depuis une fiche composant | OT créé |
| GET | `/predictions/poles` | Liste des pôles distincts dans historique | Array de strings |
| GET | `/predictions/stats?pole=` | Stats globales (legacy simulation) | Total composants, mtbf moyen, etc. |
| GET | `/predictions/composantes?pole=&search=&rul_max=&model=` | Liste des composants avec RUL (legacy simulation/ML hybride) | Tableau de composants |
| GET | `/predictions/rul-trend/{code}` | Courbe RUL simulée (legacy) | Points {date, rul} |
| GET | `/predictions/dashboard` | Dashboard prédictif legacy | KPIs + composants |
| GET | `/predictions/filtres-meta` | Méta des filtres (pôles, zones, machines) | Listes pour selects |

---

## 🧠 3. Pipeline de calcul ML (`backend/services/ml_inference.py`)

### 3.1 `load_active_model(db)` — chargement modèle + cache singleton
**Charge UNE SEULE FOIS** (cache en mémoire tant que le même `id_modele` est actif) :
- Le modèle Keras (`.keras`) via `tf.keras.models.load_model()`
- Le **scaler_x** (joblib, sinon pickle) — `MinMaxScaler` fit sur 9 features
- Le **scaler_y** (joblib, sinon pickle) — `MinMaxScaler` fit sur RUL (0-30 jours)
- Le **`metadata.json`** : `lookback=30`, `max_rul=30`, `levels_modelises=[3,4]`, métriques test
- Le **`comp_mapping.json`** : 164 composants → index entier pour l'embedding du modèle

### 3.2 `get_test_codes(db)` → 33 composants test
1. Cherche `storage/models/v1-GRU/test_codes.json`
2. **Fallback** (cas actuel) : les **33 derniers** codes du `comp_mapping` par ordre alphabétique

### 3.3 `_build_daily_panel(corr_rows, ref_date, comp_level, lookback=30)`

**Reproduction exacte du notebook PFE Cevital.**

Étapes :
1. Récupère toutes les pannes CORR d'un composant entre `ref_date - 120 jours` et `ref_date`
2. Construit un panel journalier (1 ligne / jour) avec :
   - `failure` = 1 si une panne ce jour-là, sinon 0
   - `maintenance` = 1 si `date_fin` d'une intervention ce jour-là, sinon 0
3. Calcule les **9 features** dans cet ordre :

| # | Feature | Formule |
|---|---|---|
| 1 | `comp_level` | constant (3 ou 4) — niveau hiérarchique |
| 2 | `pannes_7j` | `failure.shift(1).rolling(7).sum()` — nb pannes les 7 jours précédents |
| 3 | `pannes_30j` | idem rolling 30 jours |
| 4 | `pannes_90j` | idem rolling 90 jours |
| 5 | `maint_7j` | `maintenance.shift(1).rolling(7).sum()` |
| 6 | `maint_30j` | idem 30j |
| 7 | `maint_90j` | idem 90j |
| 8 | `DSLF` | **D**ays **S**ince **L**ast **F**ailure (jours depuis dernière panne) |
| 9 | `DSLM` | **D**ays **S**ince **L**ast **M**aintenance |

4. Retourne les **30 derniers jours** (`lookback`) → shape `(30, 9)`

### 3.4 `predict_one(...)` — prédiction RUL pour UN composant à UNE date

```
1. Récupère comp_idx = comp_map[equipment_code]              (int de l'embedding)
2. Construit le panel : seq = _build_daily_panel(...)        shape (30, 9)
3. Normalise : seq_scaled = scaler_x.transform(seq)          shape (30, 9)
4. Reshape  : seq_3d = seq_scaled.reshape(1, 30, 9)          shape (1, 30, 9)
5. Inférence: model.predict([seq_3d, np.array([comp_idx])])  shape (1, 1)
6. Dénormalise : rul_raw = scaler_y.inverse_transform(...)
7. Clip       : rul = max(0, min(rul_raw, 30))               (entier 0-30)
8. Calcule confiance, statut, date_panne_prevue
```

**Calcul de la confiance** (heuristique, pas du modèle) :
```python
nb_pannes  = nombre de pannes CORR dans la fenêtre 120 jours
confiance  = min(94, max(70, round(70 + (min(nb_pannes, 30) / 30) * 20)))
```
→ Confiance entre **70% et 94%**, monte vers 94% si beaucoup d'historique.

**Calcul du statut** (seuils en dur) :
```python
"CRITIQUE"     si rul <= 3
"URGENT"       si rul <= 10
"SURVEILLANCE" si rul <= 25
"OK"           sinon
```

**Calcul de `date_panne_prevue`** :
```python
date_panne_prevue = ref_date + timedelta(days=rul_jours)
```

### 3.5 `run_monthly_predictions(db, freq_days=30, test_codes_only=True, pole_filter=…)`

C'est le cœur du `/predictions/run` :

1. Charge modèle + récupère les 33 codes test
2. **Filtre par pôle** via `Equipement.id_pole` (FK fiable) ou `action_entity` (fallback)
3. Détermine la plage `date_min` → `date_max` (min/max de `date_declaration` dans historique)
4. Date de départ = `date_min + 30 + 90 + 30 = +150 jours` (pour avoir assez d'historique)
5. Pour **chaque composant test** dans le pôle :
   - Pour **chaque mois** (`current` += 30 jours jusqu'à `date_max`) :
     - Appelle `predict_one(...)` avec `ref_date=current`
     - Stocke la prédiction
6. Retourne :
   - `predictions_par_composant: { code: [predictions...] }`
   - `dernieres_predictions: [...]` (la plus récente par composant)
   - Comptages `nb_critiques`, `nb_urgents`, `nb_surveillance`, `nb_ok` sur les **dernières**

---

## 🎨 4. Frontend — Page `/predictions` (interface principale)

### Imports

`useModeleActif`, `useHistoriquePredictions`, `useLancerPrediction`, `useRunDetails` (React Query)

### 4.1 Section "Bloc lancement" (haut)
3 colonnes :

**Col 1 — Modèle actif** (depuis `GET /predictions/modele-actif`)
- Type + version (ex "GRU — v1-GRU")
- Nom (ex "GRU Champion — R²=0.74 MAE=3.45j")
- Pills : R² (indigo), MAE (purple), nb composants

**Col 2 — Sélecteur type modèle**
- 3 boutons radio : `AUTO` / `GRU` / `LSTM`
- Si user choisit GRU/LSTM, le backend active automatiquement le dernier modèle de ce type avant de lancer

**Col 3 — Bouton "Lancer la prédiction"**
- État : `lancer.isPending` → loader
- Message d'erreur si échec
- Note "premier lancement 30-60s (TensorFlow)"

### 4.2 4 KPI cards cliquables (filtrent le tableau)
- Critiques (rouge) — `nb_critiques`
- Urgents (orange) — `nb_urgents`
- Surveillance (ambre) — `nb_surveillance`
- OK (émeraude) — `nb_ok`

### 4.3 Méta du run (ligne grise)
- `Run #{id_run}`
- Date de lancement (formaté français)
- Durée (`duree_ms / 1000`s)
- Nb composants analysés
- Pôle (si filtré)

### 4.4 Section "Alertes stock"
Cards rouges montrant les 6 premiers composants critiques/urgents avec stock ABSENT ou FAIBLE :
- Code composant + description
- Pill alerte stock
- RUL en jours
- Stock disponible

### 4.5 Tableau des résultats (filtrable)
**9 colonnes** :
| Colonne | Données |
|---|---|
| Code | `equipment_code` (mono, font-bold) |
| Description | `equipment_desc` (truncate 240px) |
| Pôle / Système | `pole` + `system_equipment` |
| RUL | `rul_jours` + "j" (couleur selon statut) |
| Statut | Badge coloré (CRITIQUE/URGENT/SURVEILLANCE/OK) |
| Confiance | `confiance_pct` % |
| Panne prévue | `date_panne_prevue` (format français) |
| Stock | `alerte_stock` + `stock_disponible` |
| Actions | Bouton "Détail" → `/predictions/composant/{code}` |

**Filtres** : recherche texte (code, description, pôle) + filtre statut.

### 4.6 Section "Historique des prédictions"
Tableau **11 colonnes** :
- Run # / Lancé le / Pôle / Statut / Composants / Crit. / Urg. / Surv. / OK / Durée / Bouton "Voir"

---

## 🎨 5. Frontend — Page détail `/predictions/composant/[code]`

### 5.1 Header avec gros RUL
- Code composant (mono, 2xl, bold)
- Description
- Pills : système_equipment, pôle, niveau, "Prédiction ML" (bleu indigo avec icône Brain)
- Gros chiffre RUL (5xl, coloré selon statut)
- Date panne prévue + Confiance
- Badge statut
- Encart "Recommandation" (texte selon statut)

### 5.2 5 KPI cards
- Nb pannes historiques (rouge)
- MTBF (indigo)
- MTTR (ambre)
- Disponibilité (émeraude)
- Coût total (purple)

### 5.3 2 colonnes "Machine racine" et "Stock"

**Machine racine** (via `Equipement.id_machine_racine`):
- Système / Machine
- Pôle
- Équipement parent (code + description + niveau)
- Niveau composant

**Stock pièces de rechange** (via `ComposanteStock → PieceStock`):
- État : null (non géré) / 0 pièces / X pièces
- Bandeau résumé : alerte globale, qté totale
- Liste détaillée par pièce : code_stock, désignation, qté, seuil, alerte, emplacement

### 5.4 Histogramme "Pannes réelles vs Dernière panne prédite"
- Barres rouges = pannes réelles par mois
- Barre cyan = la **dernière** prédiction faite
- Compteurs en haut : nb réelles, "1 prédiction (dernière)"

### 5.5 Tableau "Pannes historiques + Dernière prédiction"
**7 colonnes** :
- Type (badge RÉELLE rouge / PRÉDITE cyan)
- Date
- RUL (j) — seulement pour PRÉDITE
- Statut — seulement pour PRÉDITE
- Durée (date_fin - date_declaration en jours)
- Coût
- Source (ML / SAP / etc.)

### 5.6 Bouton "Générer un OT Prédictif"
Ouvre modal :
- Classe (MECANIQUE/ELECTRIQUE/GLOBALE)
- Priorité (auto-remplie selon statut : CRITIQUE→CRITIQUE, URGENT→HAUTE, etc.)
- Date prévue (auto = aujourd'hui + RUL - 2 jours)
- Durée estimée (120 min par défaut)
- Description (auto-remplie avec contexte ML)

---

## 📐 6. Calculs frontend (page détail)

### 6.1 MTBF (Mean Time Between Failures)
```js
dates = sort(pannes.map(p => date_declaration))
if (dates.length >= 2):
  mtbf = (max(dates) - min(dates)) / (dates.length - 1)   // jours
else:
  mtbf = null
```

### 6.2 MTTR (Mean Time To Repair)
```js
durees = pannes
  .filter(p => p.date_fin && p.date_fin >= p.date_declaration)
  .map(p => (p.date_fin - p.date_declaration) en jours)
mttr = sum(durees) / len(durees)
```

### 6.3 Disponibilité
```js
disponibilite = (1 - mttr / mtbf) * 100
```

### 6.4 Coût total
```js
cout_total = sum(pannes.map(p => p.cout_total))
```

### 6.5 Histogramme par mois
```js
buckets = {}
for panne in historique_pannes:
  key = `${année}-${mois}`
  buckets[key].reelles += 1

for prediction in historique_predictions:    // limit(1) côté backend
  key = `${année}-${mois}` de date_panne_prevue
  buckets[key].predites += 1
```

---

## 🔧 7. Types TypeScript (frontend/src/types/prediction.ts)

```typescript
type StatutRUL    = 'CRITIQUE' | 'URGENT' | 'SURVEILLANCE' | 'OK'
type StatutRun    = 'EN_COURS' | 'TERMINE' | 'ERREUR'
type SourcePred   = 'ML' | 'SIMULATION'
type AlerteStock  = 'OK' | 'FAIBLE' | 'ABSENT'

interface PredictionResultat {
  id_resultat       : number
  equipment_code    : string
  equipment_desc    : string | null
  system_equipment  : string | null
  pole              : string | null
  comp_level        : number | null
  rul_jours         : number
  statut            : StatutRUL
  date_panne_prevue : string | null
  confiance_pct     : number | null
  source            : SourcePred
  stock_disponible  : number | null
  alerte_stock      : AlerteStock | null
}

interface PredictionRun {
  id_run, id_modele, pole, statut, nb_composants, nb_critiques,
  nb_urgents, nb_surveillance, nb_ok, duree_ms, launched_at, finished_at,
  resultats: PredictionResultat[]
}
```

---

## 🎯 8. Synthèse — Ce qui est probablement "en trop" sur l'interface actuelle

D'après ton retour ("trop chargé, beaucoup de choses inutiles") :

### Probablement à virer / cacher par défaut
- Tableau "Historique des prédictions" toujours visible → mettre derrière un onglet ou popover
- KPI cards × 4 redondantes avec le badge dans le tableau → fusionner
- Section "Alertes stock" séparée (déjà visible dans le tableau via la colonne stock)
- Méta du run sur une ligne séparée → peut être en tooltip
- Confiance % (heuristique non basée sur le modèle, peu informative)
- 9 colonnes dans le tableau → ramener à 5-6 essentielles
- Sélecteur AUTO/GRU/LSTM en 3 boutons → un seul dropdown plus discret

### Probablement à garder/mettre en avant
- **RUL prédit + statut + date prévue** (la vraie info utile)
- **Stock** (ABSENT/FAIBLE = action immédiate)
- **Bouton "Détail"** → page composant
- **Lien direct vers création OT prédictif** (souvent on veut agir vite)

### Probablement à ajouter
- Graphe global "Répartition statuts" (donut) à la place des 4 KPI cards
- Carte/heatmap "Machines à risque par zone/pôle"
- Tendance run-sur-run (le statut a-t-il empiré depuis le dernier run ?)
- Notifications poussées pour les CRITIQUES nouvellement détectés

---

## 📝 9. Questions à se poser pour la refonte

1. **Qui est l'utilisateur principal ?** Méthodiste qui pilote la maintenance d'un pôle.
2. **Quelle est la 1ʳᵉ chose qu'il veut savoir ?** "Quels composants vont tomber bientôt + ai-je le stock ?"
3. **Quelle est l'action attendue ?** Créer un OT prédictif anticipé.
4. **Fréquence d'usage ?** Quotidienne ou hebdomadaire, pas chaque heure.
5. **Combien d'éléments à afficher ?** ~33 composants → reste dans 1-2 écrans.

---

**Prochaine étape suggérée** : tu décides quoi garder/virer en relisant ce doc,
puis on dessine ensemble une nouvelle maquette (texte ou wireframe) avant de coder.
