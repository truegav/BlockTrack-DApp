import { useMemo } from 'react';
import { useWallet } from '../context/WalletContext.jsx';
import { useVault } from '../context/VaultContext.jsx';
import { useProfile, useRoles } from './useProfile.js';
import { shortAddress } from '../lib/format.js';

export function useSession() {
  const wallet = useWallet();
  const vault = useVault();
  const profileQuery = useProfile(wallet.address);
  const rolesQuery = useRoles(wallet.address);

  const profile = profileQuery.data ?? null;
  const roles = rolesQuery.data ?? null;
  const role = roles?.role ?? 'customer';
  const name =
    profile?.displayName ||
    wallet.persona?.name ||
    shortAddress(wallet.address) ||
    'Guest';

  const keyMatches = useMemo(() => {
    if (!profile?.exists || !vault.publicKey) return null;
    return (
      String(profile.encryptionKey).toLowerCase() ===
      String(vault.publicKey).toLowerCase()
    );
  }, [profile, vault.publicKey]);

  return {
    wallet,
    vault,
    profile,
    roles,
    role,
    name,
    profileQuery,
    rolesQuery,
    keyMatches,
    isLoading: profileQuery.isLoading || rolesQuery.isLoading,
    error: profileQuery.error || rolesQuery.error,
  };
}
