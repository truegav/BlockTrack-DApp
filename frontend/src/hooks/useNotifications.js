import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '../context/WalletContext.jsx';
import { readString, writeString } from '../lib/storage.js';
import { statusMeta } from '../lib/status.js';

function ageTimestamp() {
  return Math.floor(Date.now() / 1000);
}

export function useNotifications(orders = []) {
  const wallet = useWallet();
  const storageKey = `notifSeen:${wallet.deployment.contractAddress}:${(
    wallet.address || ''
  ).toLowerCase()}`;

  const [lastSeen, setLastSeen] = useState(0);
  const seededRef = useRef(false);

  useEffect(() => {
    setLastSeen(Number(readString(storageKey, '0')) || 0);
    seededRef.current = false;
  }, [storageKey]);

  const items = useMemo(() => {
    const output = [];

    for (const order of orders) {
      if (!order.access) continue;

      const recipient = order.payload?.recipient;
      const parcel = order.payload?.parcel;
      const route = [recipient?.city, parcel?.description]
        .filter(Boolean)
        .join(' · ');

      output.push({
        key: `${order.id}-created`,
        type: 'created',
        orderId: order.id,
        timestamp: order.createdAt,
        status: 'Created',
        title: 'Order registered',
        body: route || 'Encrypted shipment registered on-chain.',
        recipient: recipient?.name || '',
      });

      for (const update of order.history ?? []) {
        if (
          update.status === 'Created' &&
          update.timestamp === order.createdAt
        ) {
          continue;
        }
        const meta = statusMeta(update.status);
        const note = update.note?.note;
        output.push({
          key: `${order.id}-${update.timestamp}-${update.status}`,
          type: 'status',
          orderId: order.id,
          timestamp: update.timestamp,
          status: update.status,
          title: meta.label,
          body:
            note ||
            (update.noteError
              ? 'Encrypted update — unlock your vault to read it.'
              : `${order.id} moved to ${meta.label.toLowerCase()}.`),
          recipient: recipient?.name || '',
        });
      }
    }

    return output
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 60);
  }, [orders]);

  // On the first visit for an account, treat the existing feed as read so the
  // bell starts quiet. New events after that become unread.
  useEffect(() => {
    if (seededRef.current || !items.length) return;
    const stored = readString(storageKey, null);
    if (stored === null) {
      const latest = items[0].timestamp;
      writeString(storageKey, String(latest));
      setLastSeen(latest);
    }
    seededRef.current = true;
  }, [items, storageKey]);

  const unreadCount = useMemo(
    () => items.filter((item) => item.timestamp > lastSeen).length,
    [items, lastSeen]
  );

  const markAllRead = useCallback(() => {
    const latest = items[0]?.timestamp ?? ageTimestamp();
    writeString(storageKey, String(latest));
    setLastSeen(latest);
  }, [items, storageKey]);

  return { items, unreadCount, markAllRead, lastSeen };
}
