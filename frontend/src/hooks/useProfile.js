import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '../context/WalletContext.jsx';
import { getContract } from '../lib/contract.js';

function normalizeProfile(address, result) {
  const [displayName, encryptionKey, exists] = result;
  return {
    address,
    displayName: displayName || '',
    encryptionKey: encryptionKey || '0x',
    exists: Boolean(exists),
  };
}

export function useProfile(address) {
  const wallet = useWallet();
  const normalized = (address || '').toLowerCase();

  return useQuery({
    queryKey: ['profile', wallet.deployment.contractAddress, normalized],
    enabled: Boolean(normalized && wallet.provider),
    staleTime: 30_000,
    queryFn: async () => {
      const contract = getContract(
        wallet.deployment.contractAddress,
        wallet.provider
      );
      const result = await contract.getProfile(address);
      return normalizeProfile(address, result);
    },
  });
}

export function useProfiles(addresses = []) {
  const wallet = useWallet();
  const unique = useMemo(() => {
    const seen = new Set();
    return addresses
      .filter(Boolean)
      .map((address) => String(address))
      .filter((address) => {
        const key = address.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [addresses]);

  const query = useQuery({
    queryKey: [
      'profiles',
      wallet.deployment.contractAddress,
      unique.map((address) => address.toLowerCase()).join(','),
    ],
    enabled: Boolean(unique.length && wallet.provider),
    staleTime: 30_000,
    queryFn: async () => {
      const contract = getContract(
        wallet.deployment.contractAddress,
        wallet.provider
      );
      const rows = await Promise.all(
        unique.map(async (address) => {
          const result = await contract.getProfile(address);
          return normalizeProfile(address, result);
        })
      );
      return Object.fromEntries(
        rows.map((profile) => [profile.address.toLowerCase(), profile])
      );
    },
  });

  return {
    ...query,
    data: query.data ?? {},
  };
}

export function useRoles(address) {
  const wallet = useWallet();
  return useQuery({
    queryKey: [
      'roles',
      wallet.deployment.contractAddress,
      (address || '').toLowerCase(),
    ],
    enabled: Boolean(address && wallet.provider),
    staleTime: 20_000,
    queryFn: async () => {
      const contract = getContract(
        wallet.deployment.contractAddress,
        wallet.provider
      );
      const [isAdmin, isCourier] = await Promise.all([
        contract.isAdmin(address),
        contract.isLogistics(address),
      ]);
      return {
        isAdmin,
        isCourier,
        role: isAdmin ? 'admin' : isCourier ? 'courier' : 'customer',
      };
    },
  });
}

export function useAdmins() {
  const wallet = useWallet();
  const listQuery = useQuery({
    queryKey: ['admins', wallet.deployment.contractAddress],
    enabled: Boolean(wallet.provider),
    staleTime: 30_000,
    queryFn: async () => {
      const contract = getContract(
        wallet.deployment.contractAddress,
        wallet.provider
      );
      return [...(await contract.getAdmins())];
    },
  });

  const addresses = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const profilesQuery = useProfiles(addresses);

  const admins = useMemo(
    () =>
      addresses.map((address) => {
        const profile = profilesQuery.data[address.toLowerCase()];
        return {
          address,
          name: profile?.displayName || '',
          publicKey: profile?.encryptionKey || '0x',
          exists: profile?.exists || false,
        };
      }),
    [addresses, profilesQuery.data]
  );

  return {
    admins,
    isLoading: listQuery.isLoading || profilesQuery.isLoading,
    error: listQuery.error || profilesQuery.error,
    refetch: async () => {
      await listQuery.refetch();
      await profilesQuery.refetch();
    },
  };
}

export function useCouriers() {
  const wallet = useWallet();
  const listQuery = useQuery({
    queryKey: ['couriers', wallet.deployment.contractAddress],
    enabled: Boolean(wallet.provider),
    staleTime: 15_000,
    queryFn: async () => {
      const contract = getContract(
        wallet.deployment.contractAddress,
        wallet.provider
      );
      return [...(await contract.getCouriers())];
    },
  });

  const addresses = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const profilesQuery = useProfiles(addresses);

  const couriers = useMemo(
    () =>
      addresses.map((address) => {
        const profile = profilesQuery.data[address.toLowerCase()];
        return {
          address,
          name: profile?.displayName || '',
          publicKey: profile?.encryptionKey || '0x',
          exists: profile?.exists || false,
        };
      }),
    [addresses, profilesQuery.data]
  );

  return {
    couriers,
    isLoading: listQuery.isLoading || profilesQuery.isLoading,
    error: listQuery.error || profilesQuery.error,
    refetch: async () => {
      await listQuery.refetch();
      await profilesQuery.refetch();
    },
  };
}

export function useProfilesList() {
  const wallet = useWallet();
  return useQuery({
    queryKey: ['profiles-list', wallet.deployment.contractAddress],
    enabled: Boolean(wallet.provider),
    staleTime: 20_000,
    queryFn: async () => {
      const contract = getContract(
        wallet.deployment.contractAddress,
        wallet.provider
      );
      const logs = await contract.queryFilter(
        contract.filters.ProfileRegistered(),
        wallet.deployment.deploymentBlock,
        'latest'
      );
      const addresses = [
        ...new Set(
          logs
            .map((log) => log.args?.account)
            .filter(Boolean)
            .map((address) => address)
        ),
      ];
      const rows = await Promise.all(
        addresses.map(async (address) => {
          const result = await contract.getProfile(address);
          return normalizeProfile(address, result);
        })
      );
      return rows.sort((a, b) =>
        (a.displayName || a.address).localeCompare(b.displayName || b.address)
      );
    },
  });
}
