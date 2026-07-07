-- Ajouter les types de notifications manquants
INSERT INTO notifications_config (type_notification, actif, delai_jours, template_sujet, template_contenu)
VALUES 
  ('rappel_cotisation', true, 7, 
   'Rappel : Cotisation impayée - {type_cotisation}',
   'Bonjour {prenom} {nom},

Nous vous rappelons que votre cotisation "{type_cotisation}" pour la réunion du {date_reunion} reste impayée.
Montant dû : {montant} FCFA

Merci de régulariser votre situation.

Cordialement,
L''équipe E2D'),
  
  ('rappel_pret', true, 7,
   'Rappel : Échéance de prêt le {date_echeance}',
   'Bonjour {prenom} {nom},

Votre prêt de {montant_initial} FCFA arrive à échéance le {date_echeance}.

Capital restant : {capital_restant} FCFA
Intérêts dus : {interets_dus} FCFA
Total à payer : {total_du} FCFA

Merci de prévoir le remboursement.

Cordialement,
L''équipe E2D'),
  
  ('sanction_notification', true, 0,
   'Notification de sanction - E2D',
   'Bonjour {prenom} {nom},

Une sanction a été enregistrée à votre encontre :

Motif : {motif}
Montant : {montant} FCFA
Date : {date_sanction}

Pour toute question, veuillez contacter le bureau.

Cordialement,
L''équipe E2D')
ON CONFLICT (type_notification) DO NOTHING;