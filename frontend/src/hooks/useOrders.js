import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBytes } from 'ethers';
import { useWallet } from '../context/WalletContext.jsx';
import { useVault } from '../context/VaultContext.jsx';
import { useRoles } from './useProfile.js';
import { getContract } from '../lib/contract.js';
import {
  decryptNote,
  decryptPayload,
  unwrapOrderKey,
} from '../shared/crypto.js';
import { STATUS_BY_INDEX, isFinalStatus } from '../lib/status.js';

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(items[index], index);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

function normalizeOrder(raw) {
  const meta = STATUS_BY_INDEX[Number(raw[3])] ?? STATUS_BY_INDEX[0];
  return {
    id: raw[0],
    owner: raw[1],
    courier: raw[2],
    statusIndex: Number(raw[3]),
    status: meta.key,
    statusMeta: meta,
    createdAt: Number(raw[4]),
    updatedAt: Number(raw[5]),
    ciphertext: raw[6],
    exists: Boolean(raw[7]),
  };
}

async function normalizeHistory(rawHistory, orderKey, orderId) {
  const history = [];
  for (const raw of rawHistory) {
    const meta = STATUS_BY_INDEX[Number(raw.status)] ?? STATUS_BY_INDEX[0];
    const item = {
      statusIndex: Number(raw.status),
      status: meta.key,
      statusMeta: meta,
      timestamp: Number(raw.timestamp),
      actor: raw.actor,
      encryptedNote: raw.encryptedNote,
      note: null,
      noteError: false,
    };

    if (orderKey && raw.encryptedNote && raw.encryptedNote !== '0x') {
      try {
        item.note = await decryptNote(
          getBytes(raw.encryptedNote),
          orderKey,
          orderId
        );
      } catch {
        item.noteError = true;
      }
    }
    history.push(item);
  }
  return history;
}

async function loadAccessibleOrder(
  contract,
  { id, address, vaultKey, includeHolders = false }
) {
  const requests = [
    contract.getOrder(id),
    contract.getWrappedKey(id, address),
    contract.getTrackingHistory(id),
  ];
  if (includeHolders) requests.push(contract.getKeyHolders(id));

  const [rawOrder, wrappedKey, rawHistory, keyHoldersRaw] =
    await Promise.all(requests);
  const order = normalizeOrder(rawOrder);

  if (!wrappedKey || wrappedKey === '0x') {
    return {
      ...order,
      access: false,
      payload: null,
      history: [],
      keyHolders: keyHoldersRaw ? [...keyHoldersRaw] : [],
    };
  }

  let orderKey = null;
  try {
    orderKey = unwrapOrderKey(getBytes(wrappedKey), vaultKey);
  } catch {
    return {
      ...order,
      access: false,
      keyError: true,
      payload: null,
      history: [],
      keyHolders: keyHoldersRaw ? [...keyHoldersRaw] : [],
    };
  }

  let payload = null;
  let decryptError = false;
  try {
    payload = await decryptPayload(
      getBytes(order.ciphertext),
      orderKey,
      order.id
    );
  } catch {
    decryptError = true;
  }

  const history = await normalizeHistory(rawHistory, orderKey, order.id);

  return {
    ...order,
    access: true,
    payload,
    decryptError,
    history,
    orderKey,
    keyHolders: keyHoldersRaw ? [...keyHoldersRaw] : [],
  };
}

async function queryCreatedLogs(contract, fromBlock, owner) {
  const filter = owner
    ? contract.filters.OrderCreated(null, owner)
    : contract.filters.OrderCreated();
  try {
    return await contract.queryFilter(filter, fromBlock, 'latest');
  } catch (error) {
    if (fromBlock > 0) {
      return contract.queryFilter(filter, 0, 'latest');
    }
    throw error;
  }
}

async function queryAssignedLogs(contract, fromBlock, courier) {
  const filter = contract.filters.CourierAssigned(null, courier);
  try {
    return await contract.queryFilter(filter, fromBlock, 'latest');
  } catch (error) {
    if (fromBlock > 0) {
      return contract.queryFilter(filter, 0, 'latest');
    }
    throw error;
  }
}

async function loadOrders({ contract, deployment, address, role, vaultKey }) {
  const fromBlock = deployment.deploymentBlock;
  const txHashes = new Map();
  let ids = [];

  if (role === 'admin') {
    const logs = await queryCreatedLogs(contract, fromBlock, null);
    for (const log of logs) {
      const id = log.args?.trackingId;
      if (!id) continue;
      ids.push(id);
      txHashes.set(id, log.transactionHash);
    }
  } else if (role === 'courier') {
    const logs = await queryAssignedLogs(contract, fromBlock, address);
    ids = [
      ...new Set(logs.map((log) => log.args?.trackingId).filter(Boolean)),
    ];
  } else {
    const logs = await queryCreatedLogs(contract, fromBlock, address);
    for (const log of logs) {
      const id = log.args?.trackingId;
      if (!id) continue;
      ids.push(id);
      txHashes.set(id, log.transactionHash);
    }
  }

  ids = [...new Set(ids)];
  if (ids.length === 0) return [];

  const orders = await mapLimit(ids, 6, (id) =>
    loadAccessibleOrder(contract, { id, address, vaultKey })
  );

  return orders
    .filter((order) => order.exists)
    .filter(
      (order) =>
        role !== 'courier' ||
        order.courier?.toLowerCase() === address.toLowerCase()
    )
    .map((order) => ({
      ...order,
      createdTxHash: txHashes.get(order.id) ?? null,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function useOrders() {
  const wallet = useWallet();
  const vault = useVault();
  const rolesQuery = useRoles(wallet.address);
  const role = rolesQuery.data?.role ?? null;

  const query = useQuery({
    queryKey: [
      'orders',
      wallet.deployment.contractAddress,
      wallet.address?.toLowerCase(),
      role,
      vault.fingerprint,
    ],
    enabled: Boolean(
      wallet.address && wallet.provider && vault.isUnlocked && vault.vaultKey && role
    ),
    staleTime: 5_000,
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const contract = getContract(
        wallet.deployment.contractAddress,
        wallet.provider
      );
      return loadOrders({
        contract,
        deployment: wallet.deployment,
        address: wallet.address,
        role,
        vaultKey: vault.vaultKey,
      });
    },
  });

  return {
    orders: query.data ?? [],
    isLoading: query.isLoading || rolesQuery.isLoading,
    isFetching: query.isFetching,
    error: query.error || rolesQuery.error,
    refetch: query.refetch,
    role,
    roles: rolesQuery.data,
    roleLoading: rolesQuery.isLoading,
  };
}

export function useOrder(id) {
  const wallet = useWallet();
  const vault = useVault();

  return useQuery({
    queryKey: [
      'order',
      wallet.deployment.contractAddress,
      wallet.address?.toLowerCase(),
      id,
      vault.fingerprint,
    ],
    enabled: Boolean(
      id && wallet.address && wallet.provider && vault.isUnlocked && vault.vaultKey
    ),
    staleTime: 4_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const contract = getContract(
        wallet.deployment.contractAddress,
        wallet.provider
      );
      const order = await loadAccessibleOrder(contract, {
        id,
        address: wallet.address,
        vaultKey: vault.vaultKey,
        includeHolders: true,
      });

      let createdTxHash = null;
      try {
        const logs = await contract.queryFilter(
          contract.filters.OrderCreated(),
          wallet.deployment.deploymentBlock,
          'latest'
        );
        createdTxHash =
          logs.find((log) => log.args?.trackingId === id)?.transactionHash ?? null;
      } catch {
        // optional detail
      }

      return { ...order, createdTxHash };
    },
  });
}

export function usePublicOrder(id) {
  const wallet = useWallet();
  return useQuery({
    queryKey: ['public-order', wallet.deployment.contractAddress, id],
    enabled: Boolean(id && wallet.provider),
    staleTime: 10_000,
    refetchInterval: 20_000,
    queryFn: async () => {
      const contract = getContract(
        wallet.deployment.contractAddress,
        wallet.provider
      );
      const [statusResult, historyResult] = await Promise.all([
        contract.getPublicStatus(id),
        contract.getPublicHistory(id),
      ]);
      const meta = STATUS_BY_INDEX[Number(statusResult[0])] ?? STATUS_BY_INDEX[0];
      return {
        id,
        statusIndex: Number(statusResult[0]),
        status: meta.key,
        statusMeta: meta,
        createdAt: Number(statusResult[1]),
        updatedAt: Number(statusResult[2]),
        history: historyResult.map((update) => {
          const updateMeta =
            STATUS_BY_INDEX[Number(update.status)] ?? STATUS_BY_INDEX[0];
          return {
            status: updateMeta.key,
            statusMeta: updateMeta,
            timestamp: Number(update.timestamp),
          };
        }),
      };
    },
  });
}

export function useOrderStats(orders) {
  return useMemo(() => {
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86_400;
    const stats = {
      total: orders.length,
      active: 0,
      inTransit: 0,
      outForDelivery: 0,
      delivered: 0,
      delivered7d: 0,
      failed: 0,
      cancelled: 0,
      unassigned: 0,
      assigned: 0,
    };

    for (const order of orders) {
      if (order.status === 'Delivered') {
        stats.delivered += 1;
        if (order.updatedAt >= sevenDaysAgo) stats.delivered7d += 1;
      } else if (order.status === 'Cancelled') {
        stats.cancelled += 1;
      } else {
        stats.active += 1;
        if (order.status === 'InTransit') stats.inTransit += 1;
        if (order.status === 'OutForDelivery') stats.outForDelivery += 1;
        if (order.status === 'FailedAttempt') stats.failed += 1;
        if (!order.courier || order.courier === '0x0000000000000000000000000000000000000000') {
          stats.unassigned += 1;
        } else {
          stats.assigned += 1;
        }
      }
    }

    return stats;
  }, [orders]);
}

export { loadAccessibleOrder };
