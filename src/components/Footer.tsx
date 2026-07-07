import { Facebook, Mail, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import logoE2D from "@/assets/logo-e2d.png";
import { useSiteConfig } from "@/hooks/useSiteContent";
import { Skeleton } from "@/components/ui/skeleton";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { data: config, isLoading } = useSiteConfig();

  const getConfigValue = (key: string) => {
    return config?.find(c => c.cle === key)?.valeur || '';
  };

  if (isLoading) {
    return (
      <footer className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <Skeleton className="h-32 w-full" />
        </div>
      </footer>
    );
  }

  const footerLinks = {
    "Navigation": [
      { label: "Accueil", to: "/#accueil", external: false },
      { label: "À propos", to: "/#apropos", external: false },
      { label: "Activités", to: "/#activites", external: false },
      { label: "Événements", to: "/#evenements", external: false }
    ],
    "Ressources": [
      { label: "Galerie", to: "/#galerie", external: false },
      { label: "Partenaires", to: "/#partenaires", external: false },
      { label: "Contact", to: "/#contact", external: false },
      { label: "Portail Membre", to: "/dashboard", external: false }
    ],
    "Soutenir": [
      { label: "Faire un don", to: "/don", external: false },
      { label: "Devenir membre", to: "/adhesion", external: false }
    ]
  };

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img src={logoE2D} alt="Logo E2D" className="h-12 w-auto" />
              <span className="font-bold text-xl">{getConfigValue('site_nom') || 'Association Sportive E2D'}</span>
            </div>
            <p className="text-primary-foreground/80 mb-6 max-w-md">
              {getConfigValue('site_description')}
            </p>
            <div className="flex space-x-4">
              {/* D6 — N'affiche les icônes que si la config fournit une valeur, sinon évite un href="" mort. */}
              {getConfigValue('facebook_url') && (
                <a
                  href={getConfigValue('facebook_url')}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-10 h-10 rounded-lg bg-white/10 hover:bg-secondary flex items-center justify-center transition-colors duration-200"
                >
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              {getConfigValue('site_email') && (
                <a
                  href={`mailto:${getConfigValue('site_email')}`}
                  aria-label="Email"
                  className="w-10 h-10 rounded-lg bg-white/10 hover:bg-secondary flex items-center justify-center transition-colors duration-200"
                >
                  <Mail className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>

          {/* Links Sections */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-bold text-lg mb-4">{title}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-primary-foreground/80 hover:text-secondary transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-sm text-primary-foreground/70 text-center md:text-left">
              © {currentYear} {getConfigValue('site_nom') || 'Association Sportive E2D'}. Tous droits réservés.
            </p>
            <p className="text-sm text-primary-foreground/70 flex items-center">
              Fait avec <Heart className="w-4 h-4 mx-1 text-secondary" /> pour la communauté {getConfigValue('site_nom') || 'E2D'}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
