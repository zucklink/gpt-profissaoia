/**
 * Application Identity (Brand)
 *
 * Also note that the 'Brand' is used in the following places:
 *  - README.md               all over
 *  - package.json            app-slug and version
 *  - [public/manifest.json]  name, short_name, description, theme_color, background_color
 */
export const Brand = {
  Title: {
    Base: 'GPT Profissão IA',
    Common: (process.env.NODE_ENV === 'development' ? '[DEV] ' : '') + 'GPT Profissão IA',
  },
  Meta: {
    Description: 'GPT Profissão IA - Desbloqueie todo o potencial da IA, com controle preciso sobre seus dados e modelos. Personas de IA, recursos avançados e UX divertida.',
    SiteName: 'GPT Profissão IA',
    ThemeColor: '#32383E',
    TwitterSite: '',
  },
  URIs: {
    Home: 'https://profissaoia.com',
    // App: 'https://get.big-agi.com',
    CardImage: 'https://d29k11s3lp6qcl.cloudfront.net/1707491572296_roxo-claro-transp.png',
    OpenRepo: '',
    OpenProject: '',
    SupportInvite: '',
    Twitter: '',
    PrivacyPolicy: '',
  },
} as const;
