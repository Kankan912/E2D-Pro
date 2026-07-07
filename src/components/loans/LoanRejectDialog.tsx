import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useRejectLoanStep } from "@/hooks/useLoanRequests";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requestId: string | null;
}

export function LoanRejectDialog({ open, onOpenChange, requestId }: Props) {
  const [motif, setMotif] = useState("");
  const reject = useRejectLoanStep();

  const onSubmit = async () => {
    if (!requestId || motif.trim().length < 5) return;
    await reject.mutateAsync({ requestId, motif: motif.trim() });
    setMotif("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setMotif(""); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rejeter la demande</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="motif">Motif du rejet (obligatoire, min 5 caractères)</Label>
          <Textarea
            id="motif"
            rows={4}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Expliquez pourquoi cette demande est rejetée..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            variant="destructive"
            disabled={motif.trim().length < 5 || reject.isPending}
            onClick={onSubmit}
          >
            {reject.isPending ? "Rejet..." : "Confirmer le rejet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
