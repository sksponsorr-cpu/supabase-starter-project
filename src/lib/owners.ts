/** Adresses propriétaires : accès administrateur garanti, sur tous les domaines. */
export const OWNER_EMAILS = ["bonjoceflash@gmail.com", "sksponsorr@gmail.com"];

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase().trim());
}
