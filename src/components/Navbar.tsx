import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoE2D from "@/assets/logo-e2d.png";


const Navbar = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("accueil");
  const [isScrolled, setIsScrolled] = useState(false);


  const menuItems = [
    { label: "Accueil", href: "#accueil" },
    { label: "À propos", href: "#apropos" },
    { label: "Activités", href: "#activites" },
    { label: "Événements", href: "#evenements" },
    { label: "Galerie", href: "#galerie" },
    { label: "Partenaires", href: "#partenaires" },
    { label: "Contact", href: "#contact" },
  ];

  // Detect active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);

      // Detect active section
      const sections = menuItems.map(item => item.href.replace("#", ""));
      const scrollPosition = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i]);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i]);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-300 ${
        isScrolled 
          ? "bg-background/95 backdrop-blur-md border-b border-border shadow-sm" 
          : "bg-background/80 backdrop-blur-sm"
      }`}
    >

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <a 
            href="#accueil" 
            onClick={(e) => { e.preventDefault(); handleNavClick("#accueil"); }}
            className="flex items-center space-x-3 group"
          >
            <img 
              src={logoE2D} 
              alt="Logo E2D" 
              loading="lazy"
              className="h-12 lg:h-16 w-auto transition-transform duration-300 group-hover:scale-105"
            />
            <span className="font-bold text-lg lg:text-xl text-foreground hidden sm:inline-block">
              Association E2D
            </span>
          </a>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center space-x-1">
            {menuItems.map((item) => {
              const isActive = activeSection === item.href.replace("#", "");
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => { e.preventDefault(); handleNavClick(item.href); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? "text-primary bg-primary/10" 
                      : "text-foreground/80 hover:text-foreground hover:bg-accent/10"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </div>

          {/* CTA Button - Portal Access */}
          <div className="hidden lg:flex items-center space-x-4">
            <Button 
              variant="default"
              size="lg"
              className="bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary shadow-lg hover:shadow-glow transition-all duration-300"
              onClick={() => navigate("/auth")}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Portail Membre
            </Button>

          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-accent/10 transition-colors"
            aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            <div className="relative w-6 h-6">
              <Menu 
                className={`w-6 h-6 text-foreground absolute transition-all duration-300 ${
                  isOpen ? "opacity-0 rotate-90" : "opacity-100 rotate-0"
                }`} 
              />
              <X 
                className={`w-6 h-6 text-foreground absolute transition-all duration-300 ${
                  isOpen ? "opacity-100 rotate-0" : "opacity-0 -rotate-90"
                }`} 
              />
            </div>
          </button>
        </div>

        {/* Mobile Menu */}
        <div 
          className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="py-4 space-y-2">
            {menuItems.map((item) => {
              const isActive = activeSection === item.href.replace("#", "");
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => { e.preventDefault(); handleNavClick(item.href); }}
                  className={`block px-4 py-3 rounded-lg text-base font-medium transition-all ${
                    isActive 
                      ? "text-primary bg-primary/10" 
                      : "text-foreground/80 hover:text-foreground hover:bg-accent/10"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
            <Button 
              variant="default"
              size="lg"
              className="w-full bg-gradient-to-r from-secondary to-secondary/90 mt-4"
              onClick={() => {
                setIsOpen(false);
                navigate("/auth");
              }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Portail Membre E2D Connect
            </Button>

          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
