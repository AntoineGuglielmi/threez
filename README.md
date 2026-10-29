# threez

Prototype de jeu de survie en 3D isométrique avec Three.js, Vite et TypeScript.

## Prototype actuel

- Une case de départ d'hôpital, avec une sortie encore barricadée, suivie de deux CC droites placées automatiquement pendant l'installation.
- Une pioche virtuelle de 40 cartes CC : 8 cartes de chaque topologie.
- Cinq topologies : droit, virage à gauche, virage à droite, carrefour en T et carrefour en croix.
- Une main initiale de 3 CC.
- 7 actions par tour.
- Poser une CC depuis sa main coûte 1 action. La pose se fait automatiquement sur une sortie libre compatible, en orientant la topologie pour raccorder le couloir.
- Piocher une CC coûte 1 action. Si elle peut être posée, elle l'est immédiatement. Sinon, le joueur peut la défausser ou remplacer une CC de sa main par celle piochée ; l'ancienne carte est alors défaussée.
- Terminer le tour réinitialise les 7 actions et complète la main jusqu'à 3 CC.

La pioche CC est actuellement indépendante de la future pioche CP. Les portes, les déplacements et les autres actions de jeu ne sont pas encore implémentés.
