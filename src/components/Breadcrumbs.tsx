import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
}

// Mapping des routes vers les labels
const routeLabels: Record<string, string> = {
  dashboard: "Tableau de bord",
  profile: "Mon Profil",
  "my-donations": "Mes Dons",
  "my-cotisations": "Mes Cotisations",
  admin: "Administration",
  membres: "Membres",
  donations: "Dons",
  adhesions: "Adhésions",
  sport: "Sport",
  site: "Site Web",
  hero: "Hero",
  events: "Événements",
  gallery: "Galerie",
  partners: "Partenaires",
  config: "Configuration",
  about: "À Propos",
  messages: "Messages",
};

export const Breadcrumbs = ({ items, showHome = true }: BreadcrumbsProps) => {
  const location = useLocation();
  
  // Si items est fourni, utiliser ces items, sinon générer depuis la route
  const breadcrumbItems = items || generateBreadcrumbsFromPath(location.pathname);

  if (breadcrumbItems.length === 0 && !showHome) return null;

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {showHome && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="flex items-center gap-1 hover:text-primary transition-colors">
                  <Home className="h-4 w-4" />
                  <span className="sr-only">Accueil</span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbItems.length > 0 && <BreadcrumbSeparator />}
          </>
        )}
        
        {breadcrumbItems.map((item, index) => (
          <BreadcrumbItem key={index}>
            {index > 0 && <BreadcrumbSeparator />}
            {item.href && index < breadcrumbItems.length - 1 ? (
              <BreadcrumbLink asChild>
                <Link to={item.href} className="hover:text-primary transition-colors">
                  {item.label}
                </Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{item.label}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    
    items.push({
      label,
      href: i < segments.length - 1 ? currentPath : undefined,
    });
  }

  return items;
}

export default Breadcrumbs;
