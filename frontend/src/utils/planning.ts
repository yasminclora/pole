// Cycle de 8 positions
export const CYCLE = [
  'Matin', 'Matin',
  'Après-midi', 'Après-midi',
  'Nuit', 'Nuit',
  'Repos', 'Repos',
]

export const ORDRE = ['Alpha', 'Bravo', 'Charlie', 'Delta']

export const QUART_MAP: Record<string, {
  label  : string
  lettre : string
  icone  : string
  couleur: string
  bg     : string
  border : string
}> = {
  'Matin': {
    label  : 'Matin',
    lettre : 'M',
    icone  : '🌅',
    couleur: 'text-green-700 dark:text-green-300',
    bg     : 'bg-green-50 dark:bg-green-900/20',
    border : 'border-green-200 dark:border-green-800',
  },
  'Après-midi': {
    label  : 'Après-midi',
    lettre : 'A',
    icone  : '🌞',
    couleur: 'text-orange-700 dark:text-orange-300',
    bg     : 'bg-orange-50 dark:bg-orange-900/20',
    border : 'border-orange-200 dark:border-orange-800',
  },
  'Nuit': {
    label  : 'Nuit',
    lettre : 'N',
    icone  : '🌙',
    couleur: 'text-blue-700 dark:text-blue-300',
    bg     : 'bg-blue-50 dark:bg-blue-900/20',
    border : 'border-blue-200 dark:border-blue-800',
  },
  'Repos': {
    label  : 'Repos',
    lettre : 'R',
    icone  : '—',
    couleur: 'text-gray-400 dark:text-gray-500',
    bg     : 'bg-gray-50 dark:bg-gray-800',
    border : 'border-gray-200 dark:border-gray-700',
  },
}

// ── Helpers dates ─────────────────────────────────────────────────────

function parseDate(dateStr: string): Date {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return d
}

function diffJours(d1: Date, d2: Date): number {
  const t1 = new Date(d1); t1.setHours(0, 0, 0, 0)
  const t2 = new Date(d2); t2.setHours(0, 0, 0, 0)
  return Math.round((t1.getTime() - t2.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Calcul quart ──────────────────────────────────────────────────────

/**
 * Calcule le quart d'une équipe pour une date donnée.
 *
 * IMPORTANT : config.position_alpha = position_initiale_cycle de l'équipe
 * C'est déjà le décalage propre à cette équipe.
 * → On N'applique PAS de décalage supplémentaire basé sur le nom.
 */
export function getQuartInfo(
  config  : { date_debut: string; position_alpha: number } | null,
  equipe  : { id_equipe: number; nom_equipe: string } | null,
  date    : Date,
  echanges: any[],
  allEquipes: any[],
) {
  // Pas de config → pas de quart calculable
  if (!config || !equipe) {
    return QUART_MAP['Repos']
  }

  const dateDebut = parseDate(config.date_debut)
  const ecart     = diffJours(date, dateDebut)

  // ✅ FIX : position_alpha est déjà la position propre à cette équipe
  // (position_initiale_cycle calculé par le backend avec décalage inclus)
  // On ajoute seulement l'écart en jours, PAS de décalage par nom
  const position = ((config.position_alpha + ecart) % 8 + 8) % 8
  let   quart    = CYCLE[position]

  // Appliquer les échanges si existants
  const echange = echanges.find(e =>
    str(e.date_echange) === str(date) &&
    (e.id_equipe_1 === equipe.id_equipe || e.id_equipe_2 === equipe.id_equipe)
  )

  if (echange) {
    const idAutre = echange.id_equipe_1 === equipe.id_equipe
      ? echange.id_equipe_2
      : echange.id_equipe_1
    const autreEquipe = allEquipes.find(e => e.id_equipe === idAutre)
    if (autreEquipe) {
      const configAutre = autreEquipe.date_reference_cycle
        ? {
            date_debut    : autreEquipe.date_reference_cycle,
            position_alpha: autreEquipe.position_initiale_cycle,
          }
        : null
      if (configAutre) {
        const ecartAutre    = diffJours(date, parseDate(configAutre.date_debut))
        const positionAutre = ((configAutre.position_alpha + ecartAutre) % 8 + 8) % 8
        quart = CYCLE[positionAutre]
      }
    }
  }

  return QUART_MAP[quart] ?? QUART_MAP['Repos']
}

function str(date: any): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

// ── Helpers semaine/mois ──────────────────────────────────────────────

export function getLundiSemaine(date: Date): Date {
  const d   = new Date(date)
  const day = d.getDay() // 0=dim, 1=lun...
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getSemaine(lundi: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lundi)
    d.setDate(lundi.getDate() + i)
    return d
  })
}

export function getMois(annee: number, mois: number): Date[] {
  const nb = new Date(annee, mois + 1, 0).getDate()
  return Array.from({ length: nb }, (_, i) => new Date(annee, mois, i + 1))
}

export const JOURS_COURTS  = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
export const MOIS_COURTS   = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
  'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
]