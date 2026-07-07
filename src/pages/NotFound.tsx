import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

import { logger } from "@/lib/logger";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logger.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-gray-600">Oups ! Page introuvable</p>
          <Link to="/" className="text-primary underline hover:text-primary/80">
            Retour à l'accueil
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default NotFound;