import { NonceManager, Wallet, getBytes } from 'ethers';
import { DEMO_PERSONAS } from '../../frontend/src/shared/personas.js';
import {
  VAULT_MESSAGE,
  deriveVaultKey,
  encryptNote,
  encryptPayload,
  generateOrderKey,
  vaultPublicKey,
  wrapOrderKey,
} from '../../frontend/src/shared/crypto.js';
import {
  ASSIGN_OFFSET_HOURS,
  CANCEL_OFFSET_HOURS,
  DEMO_ORDERS,
  SENDERS,
  STATUS_INDEX,
  STATUS_STEPS,
  STEP_OFFSET_HOURS,
} from './demo-data.mjs';

const TYPE_RANK = {
  create: 0,
  assign: 1,
  update: 2,
  cancel: 2,
};

function buildPayload(spec, owner) {
  return {
    v: 1,
    sender: { ...SENDERS[owner.id] },
    recipient: { ...spec.recipient },
    parcel: { ...spec.parcel },
    service: spec.service,
    instructions: spec.instructions,
  };
}

function buildNote(spec, status, timestamp) {
  const recipient = spec.recipient;
  const sender = SENDERS[spec.ownerId];
  const base = { v: 1 };

  if (status === 'PickedUp') {
    return {
      ...base,
      note: `Collected from ${sender.name} in ${sender.city}.`,
      location: `${sender.city} pickup`,
    };
  }
  if (status === 'InTransit') {
    return {
      ...base,
      note: `Arrived at the ${sender.city} sort facility.`,
      location: `${sender.city} hub`,
      eta: new Date((timestamp + 36 * 3600) * 1000).toISOString(),
    };
  }
  if (status === 'OutForDelivery') {
    return {
      ...base,
      note: `Out for delivery in ${recipient.city}.`,
      location: `${recipient.city} delivery centre`,
      eta: new Date((timestamp + 6 * 3600) * 1000).toISOString(),
    };
  }
  if (status === 'Delivered') {
    return {
      ...base,
      note: `Delivered to ${recipient.name}. Signed at the door.`,
      location: recipient.city,
      receivedBy: recipient.name,
    };
  }
  if (status === 'FailedAttempt') {
    return {
      ...base,
      note: `Delivery attempted, but ${recipient.name} was unavailable. A retry will be scheduled.`,
      location: recipient.city,
    };
  }
  return { ...base, note: 'Status updated.' };
}

function buildCancelNote(spec) {
  return {
    v: 1,
    note: 'Cancelled by the sender before pickup. No charges were applied in this demo.',
    location: SENDERS[spec.ownerId].city,
    reason: 'Cancelled by sender',
  };
}

async function buildProfiles(provider, log) {
  const profiles = new Map();
  for (const persona of DEMO_PERSONAS) {
    const wallet = new Wallet(persona.privateKey, provider);
    const signature = await wallet.signMessage(VAULT_MESSAGE);
    const vaultKey = await deriveVaultKey(signature);
    const publicKey = vaultPublicKey(vaultKey);
    // Local nonce tracking avoids a race where Anvil reports a stale pending
    // nonce between two immediately mined admin transactions.
    const signer = new NonceManager(wallet);
    profiles.set(persona.id, { ...persona, wallet, signer, publicKey });
  }
  log(`Derived vault keys for ${profiles.size} demo personas.`);
  return profiles;
}

async function registerProfiles(contract, profiles, log) {
  for (const profile of profiles.values()) {
    const [, existingKey, exists] = await contract.getProfile(profile.address);
    if (exists) {
      if (existingKey.toLowerCase() !== profile.publicKey.toLowerCase()) {
        throw new Error(
          `Profile for ${profile.name} exists with a different encryption key. ` +
            'Reset the demo with `npm run dev -- --reset` so the seed starts on a fresh contract.'
        );
      }
      continue;
    }
    const tx = await contract
      .connect(profile.signer)
      .registerProfile(profile.name, getBytes(profile.publicKey));
    await tx.wait();
    log(`Profile registered: ${profile.name}`);
  }
}

async function ensureRoles(contract, profiles, log) {
  const admin = profiles.get('admin');
  if (!(await contract.isAdmin(admin.address))) {
    throw new Error(
      'The deployed contract admin is not the demo admin wallet. Redeploy with the demo admin key or set ADMIN_PRIVATE_KEY consistently.'
    );
  }
  for (const id of ['courier-arjun', 'courier-priya']) {
    const courier = profiles.get(id);
    if (!(await contract.isLogistics(courier.address))) {
      const tx = await contract.connect(admin.signer).addLogisticsUser(courier.address);
      await tx.wait();
      log(`Courier role granted: ${courier.name}`);
    }
  }
}

function buildEvents(now) {
  const events = [];
  for (const spec of DEMO_ORDERS) {
    const createdTs = now - spec.createdHoursAgo * 3600;
    events.push({ ts: createdTs, type: 'create', spec });

    if (spec.courierId) {
      events.push({
        ts: createdTs + ASSIGN_OFFSET_HOURS * 3600,
        type: 'assign',
        spec,
      });
    }

    if (spec.status === 'Cancelled') {
      events.push({
        ts: createdTs + CANCEL_OFFSET_HOURS * 3600,
        type: 'cancel',
        spec,
      });
      continue;
    }

    const steps = STATUS_STEPS[spec.status] ?? [];
    steps.forEach((status, index) => {
      events.push({
        ts: createdTs + (STEP_OFFSET_HOURS[index] ?? (index + 1) * 2) * 3600,
        type: 'update',
        spec,
        status,
      });
    });
  }

  events.sort(
    (a, b) =>
      a.ts - b.ts ||
      TYPE_RANK[a.type] - TYPE_RANK[b.type] ||
      a.spec.id.localeCompare(b.spec.id)
  );
  return events;
}

/**
 * Seed the demo contract with encrypted orders, wrapped keys, assignments and
 * status updates. Everything is signed by the demo personas; no backend is used.
 */
export async function seedDemo({ provider, contract, log = console.log } = {}) {
  const latest = await provider.getBlock('latest');
  const now = Math.floor(Date.now() / 1000);
  let backdating = latest.timestamp < now - 86_400;

  if (await contract.orderExists(DEMO_ORDERS[0].id)) {
    log('Demo orders already exist on this contract; skipping seed.');
    return { skipped: true };
  }

  const profiles = await buildProfiles(provider, log);
  const admin = profiles.get('admin');

  await registerProfiles(contract, profiles, log);
  await ensureRoles(contract, profiles, log);

  const events = buildEvents(now);
  const orderKeys = new Map();
  let orderCount = 0;
  let assignmentCount = 0;
  let updateCount = 0;
  let lastTimestamp = latest.timestamp;
  let index = 0;

  async function schedule(timestamp) {
    if (!backdating) return;
    const target = Math.max(Math.floor(timestamp), lastTimestamp + 1);
    try {
      await provider.send('evm_setNextBlockTimestamp', [target]);
      lastTimestamp = target;
    } catch (error) {
      backdating = false;
      log(
        `Timestamp control unavailable; continuing with live timestamps (${error.shortMessage || error.message}).`
      );
    }
  }

  log(
    backdating
      ? 'Chain is backdated; writing a realistic 10-day order history…'
      : 'Chain is live; timestamps will reflect the current time.'
  );

  for (const event of events) {
    index += 1;
    const spec = event.spec;
    const suffix = event.status ? ` → ${event.status}` : '';
    const label = `[${index}/${events.length}] ${event.type} ${spec.id}${suffix}`;
    await schedule(event.ts);

    if (event.type === 'create') {
      const owner = profiles.get(spec.ownerId);
      const creator = profiles.get(spec.createdById);
      const orderKey = generateOrderKey();
      const payload = buildPayload(spec, owner);
      const ciphertext = await encryptPayload(payload, orderKey, spec.id);

      const holders = [owner.address];
      const wrappedKeys = [wrapOrderKey(orderKey, owner.publicKey)];
      if (owner.address.toLowerCase() !== admin.address.toLowerCase()) {
        holders.push(admin.address);
        wrappedKeys.push(wrapOrderKey(orderKey, admin.publicKey));
      }

      const writer = contract.connect(creator.signer);
      const tx =
        creator.id === 'admin' && owner.id !== 'admin'
          ? await writer.createOrderFor(
              owner.address,
              spec.id,
              ciphertext,
              holders,
              wrappedKeys
            )
          : await writer.createOrder(spec.id, ciphertext, holders, wrappedKeys);
      await tx.wait();
      orderKeys.set(spec.id, orderKey);
      orderCount += 1;
      log(`${label} ✓ (${ciphertext.length} B encrypted)`);
      continue;
    }

    const orderKey = orderKeys.get(spec.id);
    if (!orderKey) {
      throw new Error(`Seed ordering bug: no order key for ${spec.id}`);
    }

    if (event.type === 'assign') {
      const courier = profiles.get(spec.courierId);
      const wrapped = wrapOrderKey(orderKey, courier.publicKey);
      const tx = await contract
        .connect(admin.signer)
        .assignCourier(spec.id, courier.address, wrapped);
      await tx.wait();
      assignmentCount += 1;
      log(`${label} ✓`);
      continue;
    }

    if (event.type === 'update') {
      const actor = spec.courierId
        ? profiles.get(spec.courierId)
        : admin;
      const note = buildNote(spec, event.status, event.ts);
      const encryptedNote = await encryptNote(note, orderKey, spec.id);
      const tx = await contract
        .connect(actor.signer)
        .updateStatus(spec.id, STATUS_INDEX[event.status], encryptedNote);
      await tx.wait();
      updateCount += 1;
      log(`${label} ✓`);
      continue;
    }

    if (event.type === 'cancel') {
      const owner = profiles.get(spec.ownerId);
      const encryptedNote = await encryptNote(
        buildCancelNote(spec),
        orderKey,
        spec.id
      );
      const tx = await contract
        .connect(owner.signer)
        .cancelOrder(spec.id, encryptedNote);
      await tx.wait();
      updateCount += 1;
      log(`${label} ✓`);
    }
  }

  if (backdating) {
    try {
      const finalTimestamp = Math.max(
        Math.floor(Date.now() / 1000) + 2,
        lastTimestamp + 1
      );
      await provider.send('evm_setNextBlockTimestamp', [finalTimestamp]);
      await provider.send('evm_mine', []);
      lastTimestamp = finalTimestamp;
    } catch {
      // non-critical
    }
  }

  log(
    `Seed complete: ${orderCount} orders, ${assignmentCount} assignments, ${updateCount} timeline updates.`
  );

  return {
    skipped: false,
    orders: orderCount,
    assignments: assignmentCount,
    updates: updateCount,
    backdated: backdating,
    profiles: profiles.size,
  };
}
