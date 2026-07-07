import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const navigate = useNavigate();
  return (
    <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
      <ArrowLeft className="w-4 h-4 mr-2" />
      Retour
    </Button>
  );
}
