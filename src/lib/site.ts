/**
 * Cross-promotion between the games. Each game lives on its own website;
 * they are separate entities that may quietly point at each other.
 *
 * Entries render as a single muted line on the home and result screens —
 * deliberately minimal, no banners or cards. Empty list = nothing rendered.
 * Fill this in when the sibling game's public URL exists.
 */
export type CrossPromo = {
  name: string;
  url: string;
  blurb: string;
};

export const SIBLING_GAMES: CrossPromo[] = [];
