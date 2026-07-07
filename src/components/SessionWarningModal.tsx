import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { formatTimeRemaining } from '@/lib/session-utils';

interface SessionWarningModalProps {
  open: boolean;
  secondsLeft: number;
  reason: 'inactivity' | 'session_expired' | null;
  onExtend: () => void;
  onLogout: () => void;
}

export const SessionWarningModal = ({
  open,
  secondsLeft,
  reason,
  onExtend,
  onLogout
}: SessionWarningModalProps) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (open && secondsLeft > 0) {
      // Animation de la barre de progression
      const totalSeconds = reason === 'inactivity' ? 60 : 120;
      setProgress((secondsLeft / totalSeconds) * 100);
    }
  }, [secondsLeft, open, reason]);

  const title = reason === 'inactivity' 
    ? 'Session inactive' 
    : 'Fin de session';

  const description = reason === 'inactivity'
    ? "Votre session va expirer pour cause d'inactivité."
    : "Vous avez atteint la durée maximale de session.";

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          </div>
          
          <AlertDialogDescription className="text-base">
            {description}
          </AlertDialogDescription>

          {/* Countdown Display */}
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <span className="text-3xl font-bold text-destructive">
                {formatTimeRemaining(secondsLeft)}
              </span>
              <p className="text-sm text-muted-foreground mt-1">
                avant déconnexion automatique
              </p>
            </div>
            
            {/* Progress bar */}
            <div className="mt-3 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-destructive transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-4 flex-col sm:flex-row gap-2">
          <AlertDialogCancel 
            onClick={onLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Me déconnecter
          </AlertDialogCancel>
          
          <AlertDialogAction 
            onClick={onExtend}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Prolonger ma session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
