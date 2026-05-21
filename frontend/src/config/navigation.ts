import {
  LayoutDashboard, Users, Building2,
  CalendarDays, UserCircle, Wrench,
  ClipboardList, AlertTriangle, Package, Factory,
  TrendingUp, Brain,
} from 'lucide-react'

export type Role =
  | 'ADMIN' | 'METHODISTE' | 'CHEF_POLE'
  | 'CHEF_EQUIPE' | 'MECANICIEN' | 'TECHNICIEN'
  | 'HSE' | 'GESTIONNAIRE_STOCK'

export interface NavSubItem {
  label       : string
  href        : string
  allowedRoles: Role[]
}

export interface NavSection {
  title       : string
  icon        : any
  allowedRoles: Role[]
  items       : NavSubItem[]
  group      ?: string   // libellé du groupe (premier item du groupe seulement)
}

export const NAV_SECTIONS: NavSection[] = [
  {
    group       : 'Aperçu',
    title       : 'Tableau de bord',
    icon        : LayoutDashboard,
    allowedRoles: ['ADMIN','METHODISTE','CHEF_EQUIPE',
                   'MECANICIEN','TECHNICIEN','HSE','GESTIONNAIRE_STOCK'],
    items: [],
  },

  {
    title       : 'Dashboard',
    icon        : LayoutDashboard,
    allowedRoles: ['ADMIN', 'METHODISTE'],
    items: [],
  },

  {
    group       : 'Intelligence',
    title       : 'Prédictions',
    icon        : TrendingUp,
    allowedRoles: ['METHODISTE'],
    items: [
      { label: 'Lancer prédiction', href: '/predictions',
        allowedRoles: ['METHODISTE'] },
      { label: 'Historique', href: '/predictions/historique',
        allowedRoles: ['METHODISTE'] },
    ],
  },

  {
    title       : 'Modèles ML',
    icon        : Brain,
    allowedRoles: ['ADMIN'],
    items: [
      { label: 'Gestion des modèles', href: '/admin/modeles-ml',
        allowedRoles: ['ADMIN'] },
    ],
  },

  {
    group       : 'Gestion',
    title       : 'Gestion personnel',
    icon        : Users,
    allowedRoles: ['ADMIN', 'METHODISTE'],
    items: [
      { label: 'Ajouter utilisateur', href: '/utilisateurs/ajout',
        allowedRoles: ['ADMIN'] },                              // CRUD = ADMIN seul
      { label: 'Liste utilisateurs',  href: '/utilisateurs/liste',
        allowedRoles: ['ADMIN', 'METHODISTE'] },                // lecture pour METHODISTE
      { label: 'Analytique',          href: '/utilisateurs/analytique',
        allowedRoles: ['ADMIN', 'METHODISTE'] },                // lecture pour METHODISTE
    ],
  },

  {
    title       : 'Planning & Équipes',
    icon        : CalendarDays,
    allowedRoles: ['ADMIN','CHEF_EQUIPE','MECANICIEN',
                   'TECHNICIEN','HSE','METHODISTE'],
    items: [
      { label: 'Vue équipes',      href: '/equipes/vue',
        allowedRoles: ['ADMIN','CHEF_EQUIPE','METHODISTE'] },
      { label: 'Configuration',    href: '/equipes/config',
        allowedRoles: ['METHODISTE'] },
      { label: 'Demandes échange', href: '/equipes/demandes',
        allowedRoles: ['CHEF_EQUIPE'] },
      { label: 'Calendrier',       href: '/equipes/planning',
        allowedRoles: ['ADMIN','CHEF_EQUIPE','MECANICIEN',
                       'TECHNICIEN','HSE','METHODISTE'] },
    ],
  },

{
  group       : 'Maintenance',
  title       : 'Demandes d\'intervention',
  icon        : AlertTriangle,
  allowedRoles: ['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE', 'METHODISTE', 'HSE'],
  items: [
    {
      label       : 'Creer une DI',
      href        : '/di/creer',
      allowedRoles: ['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE'],
    },
    {
      label       : 'Mes DI',
      href        : '/di/mes-di',
      allowedRoles: ['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE'],
    },
    {
      label       : 'Valider les DI',
      href        : '/di/valider',
      allowedRoles: ['METHODISTE'],
    },
  ],
},

{
  title       : 'Ordres de Travail',
  icon        : ClipboardList,
  allowedRoles: ['ADMIN','METHODISTE','CHEF_EQUIPE',
                 'MECANICIEN','TECHNICIEN','HSE','GESTIONNAIRE_STOCK'],
  items: [
    {
      label       : 'Mes OT',
      href        : '/ot/mes-ot',
      allowedRoles: ['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE'],
    },
    {
      label       : 'Liste OT',
      href        : '/ot/liste',
      allowedRoles: ['METHODISTE', 'ADMIN', 'CHEF_EQUIPE', 'HSE'],
    },
    {
      label       : 'Validation OT',
      href        : '/ot/a-valider',
      allowedRoles: ['CHEF_EQUIPE', 'HSE', 'METHODISTE', 'ADMIN'],
    },
    {
      label       : 'Archives OT',
      href        : '/ot/archives',
      allowedRoles: ['METHODISTE', 'ADMIN'],
    },
    {
      label       : 'Nouvelle intervention historique',
      href        : '/historique/ajouter',
      allowedRoles: ['METHODISTE', 'ADMIN'],
    },
  ],
},



  {
    group       : 'Configuration',
    title       : 'Pôles',
    icon        : Building2,
    allowedRoles: ['ADMIN'],
    items: [
      { label: 'Ajouter pôle',    href: '/poles/ajout',
        allowedRoles: ['ADMIN'] },
      { label: 'Liste des pôles', href: '/poles/liste',
        allowedRoles: ['ADMIN'] },
    ],
  },




  
  {
    title       : 'Equipements',
    icon        : Factory,
    allowedRoles: ['ADMIN', 'METHODISTE', 'CHEF_EQUIPE'],
    items: [
      { label: 'Liste machines',  href: '/equipements',
        allowedRoles: ['ADMIN', 'METHODISTE', 'CHEF_EQUIPE'] },
      { label: 'Ajouter machine', href: '/equipements/ajouter',
        allowedRoles: ['ADMIN'] },
    ],
  },


{
    group       : 'Logistique',
    title       : 'Stock',
    icon        : Package,
    allowedRoles: ['ADMIN','GESTIONNAIRE_STOCK','MECANICIEN','TECHNICIEN','CHEF_EQUIPE'],
    items: [
      { label: 'Stock et pièces', href: '/stock/pieces',
        allowedRoles: ['ADMIN','GESTIONNAIRE_STOCK','MECANICIEN','TECHNICIEN','CHEF_EQUIPE'] },
      { label: 'Ajouter une pièce', href: '/stock/pieces/nouveau',
        allowedRoles: ['ADMIN','GESTIONNAIRE_STOCK'] },
      { label: 'Recherche pièce par équipement', href: '/stock/recherche',
        allowedRoles: ['MECANICIEN','TECHNICIEN','CHEF_EQUIPE'] },
      { label: 'Réservations',     href: '/stock/reservation',
        allowedRoles: ['ADMIN','GESTIONNAIRE_STOCK'] },
    ],
  },
 
]

export const DIRECT_LINKS: Record<string, string> = {
  'Tableau de bord': '/dashboard',
  'Dashboard'      : '/predictions/dashboard',
}