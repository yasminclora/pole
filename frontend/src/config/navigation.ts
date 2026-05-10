import {
  LayoutDashboard, Users, Building2,
  CalendarDays, UserCircle, Wrench,
  ClipboardList, AlertTriangle, Package, Factory,
  TrendingUp,
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
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title       : 'Tableau de bord',
    icon        : LayoutDashboard,
    allowedRoles: ['ADMIN','METHODISTE','CHEF_POLE','CHEF_EQUIPE',
                   'MECANICIEN','TECHNICIEN','HSE'],
    items: [],
  },

  {
    title       : 'Prédictions',
    icon        : TrendingUp,
    allowedRoles: ['ADMIN', 'METHODISTE'],
    items: [
      { label: 'Maintenance prédictive', href: '/predictions',
        allowedRoles: ['ADMIN', 'METHODISTE'] },
    ],
  },

  {
    title       : 'Gestion personnel',
    icon        : Users,
    allowedRoles: ['ADMIN','CHEF_POLE'],
    items: [
      { label: 'Ajouter utilisateur', href: '/utilisateurs/ajout',
        allowedRoles: ['ADMIN'] },
      { label: 'Liste utilisateurs',  href: '/utilisateurs/liste',
        allowedRoles: ['ADMIN','CHEF_POLE'] },
      { label: 'Analytique',          href: '/utilisateurs/analytique',
        allowedRoles: ['ADMIN','CHEF_POLE'] },
    ],
  },

  {
    title       : 'Planning & Équipes',
    icon        : CalendarDays,
    allowedRoles: ['ADMIN','CHEF_POLE','CHEF_EQUIPE','MECANICIEN',
                   'TECHNICIEN','HSE','METHODISTE'],
    items: [
      { label: 'Vue équipes',      href: '/equipes/vue',
        allowedRoles: ['ADMIN','CHEF_POLE','CHEF_EQUIPE'] },
      { label: 'Configuration',    href: '/equipes/config',
        allowedRoles: ['CHEF_POLE'] },
      { label: 'Demandes échange', href: '/equipes/demandes',
        allowedRoles: ['CHEF_EQUIPE'] },
      { label: 'Calendrier',       href: '/equipes/planning',
        allowedRoles: ['ADMIN','CHEF_POLE','CHEF_EQUIPE','MECANICIEN',
                       'TECHNICIEN','HSE','METHODISTE'] },
    ],
  },

// Section DI — déjà dans ton navigation.ts
{
  title       : 'Interventions',
  icon        : AlertTriangle,
  allowedRoles: ['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE', 'CHEF_POLE', 'METHODISTE', 'HSE'],
  items: [
    {
      label       : 'Créer une DI',
      href        : '/di/creer',          
      allowedRoles: ['MECANICIEN', 'TECHNICIEN'],
    },
    {
      label       : 'Mes DI',
      href        : '/di/mes-di',         
      allowedRoles: ['MECANICIEN', 'TECHNICIEN'],
    },
{
      label       : 'Valider les DI',
      href        : '/di/valider',        
      allowedRoles: ['METHODISTE'],       
    },
    {
      label       : 'Liste OT',
      href        : '/ot/liste',
      allowedRoles: ['METHODISTE', 'CHEF_POLE', 'ADMIN', 'CHEF_EQUIPE', 'HSE','MECANICIEN', 'TECHNICIEN'],
    },
    {
      label       : 'Mes OT',
      href        : '/ot/mes-ot',
      allowedRoles: ['MECANICIEN', 'TECHNICIEN'],
    },
    {
      label       : 'Validation OT',
      href        : '/ot/a-valider',
      allowedRoles: ['CHEF_EQUIPE', 'HSE', 'CHEF_POLE', 'ADMIN'],
    },
    {
      label       : 'Archiver les OT',
      href        : '/ot/archives',
      allowedRoles: ['METHODISTE', 'ADMIN'],
    },
  ],
},



  {
    title       : 'Pôles',
    icon        : Building2,
    allowedRoles: ['ADMIN','CHEF_POLE'],
    items: [
      { label: 'Ajouter pôle',    href: '/poles/ajout',
        allowedRoles: ['ADMIN'] },
      { label: 'Liste des pôles', href: '/poles/liste',
        allowedRoles: ['ADMIN','CHEF_POLE'] },
    ],
  },




  
  {
    title       : 'Equipements',
    icon        : Factory,
    allowedRoles: ['ADMIN', 'METHODISTE', 'CHEF_POLE', 'CHEF_EQUIPE'],
    items: [
      { label: 'Liste machines',  href: '/equipements',
        allowedRoles: ['ADMIN', 'METHODISTE', 'CHEF_POLE', 'CHEF_EQUIPE'] },
      { label: 'Ajouter machine', href: '/equipements/ajouter',
        allowedRoles: ['ADMIN'] },
    ],
  },


  {
    title       : 'Stock',
    icon        : Package,
    allowedRoles: ['ADMIN','GESTIONNAIRE_STOCK','MECANICIEN'],
    items: [
      { label: 'Rechercher',       href: '/stock',
        allowedRoles: ['ADMIN','GESTIONNAIRE_STOCK','MECANICIEN'] },
      { label: 'Liste des pièces', href: '/stock/pieces',
        allowedRoles: ['ADMIN','GESTIONNAIRE_STOCK','MECANICIEN'] },
      { label: 'Réservations',     href: '/stock/reservation',
        allowedRoles: ['ADMIN','GESTIONNAIRE_STOCK','MECANICIEN'] },
    ],
  },
 
]

export const DIRECT_LINKS: Record<string, string> = {
  'Tableau de bord': '/dashboard',
}