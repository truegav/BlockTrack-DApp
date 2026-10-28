import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isAddress } from 'ethers';
import {
  KeyRound,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Callout } from '../components/ui/Callout.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Field, TextField } from '../components/ui/Form.jsx';
import { PageSkeleton } from '../components/ui/Skeleton.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { Badge, RoleBadge } from '../components/ui/Badges.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Entity } from '../components/ui/Identity.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { SearchInput } from '../components/ui/SearchInput.jsx';
import { useAdmins, useCouriers, useProfilesList } from '../hooks/useProfile.js';
import { useToast } from '../context/ToastContext.jsx';
import { getContract, humanizeError } from '../lib/contract.js';
import { shortAddress } from '../lib/format.js';

const ZERO = '0x0000000000000000000000000000000000000000';

export function TeamPage() {
  const { session, ordersState } = useOutletContext();
  const { wallet } = session;
  const toast = useToast();
  const queryClient = useQueryClient();
  const { orders } = ordersState;
  const { couriers, isLoading: couriersLoading, refetch: refetchCouriers } = useCouriers();
  const { admins, refetch: refetchAdmins } = useAdmins();
  const profilesQuery = useProfilesList();

  const [address, setAddress] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const courierAddresses = useMemo(
    () => new Set(couriers.map((courier) => courier.address.toLowerCase())),
    [couriers]
  );
  const adminAddresses = useMemo(
    () => new Set(admins.map((admin) => admin.address.toLowerCase())),
    [admins]
  );

  const customers = useMemo(
    () =>
      (profilesQuery.data ?? []).filter(
        (profile) =>
          !courierAddresses.has(profile.address.toLowerCase()) &&
          !adminAddresses.has(profile.address.toLowerCase())
      ),
    [profilesQuery.data, courierAddresses, adminAddresses]
  );

  const activeFor = (courierAddress) =>
    orders.filter(
      (order) =>
        order.status !== 'Delivered' &&
        order.status !== 'Cancelled' &&
        order.courier?.toLowerCase() === courierAddress.toLowerCase()
    ).length;

  const ordersFor = (ownerAddress) =>
    orders.filter(
      (order) => order.owner?.toLowerCase() === ownerAddress.toLowerCase()
    );

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['couriers'] }),
      queryClient.invalidateQueries({ queryKey: ['admins'] }),
      queryClient.invalidateQueries({ queryKey: ['profiles'] }),
      queryClient.invalidateQueries({ queryKey: ['profiles-list'] }),
      queryClient.invalidateQueries({ queryKey: ['roles'] }),
    ]);
    await Promise.all([
      refetchCouriers(),
      refetchAdmins(),
      profilesQuery.refetch(),
    ]);
  };

  const addCourier = async (event) => {
    event.preventDefault();
    const target = address.trim();
    if (!isAddress(target) || target === ZERO) {
      setAddError('Enter a valid wallet address.');
      return;
    }
    if (courierAddresses.has(target.toLowerCase())) {
      setAddError('That wallet already has the courier role.');
      return;
    }

    setAdding(true);
    setAddError('');
    try {
      const signer = wallet.assertCanWrite();
      const contract = getContract(wallet.deployment.contractAddress, signer);
      const tx = await contract.addLogisticsUser(target);
      await tx.wait();
      await refreshAll();
      toast.success(
        'Courier role granted',
        'They must sign in once to register their encryption key before you can assign orders.'
      );
      setAddress('');
    } catch (cause) {
      setAddError(humanizeError(cause).message);
    } finally {
      setAdding(false);
    }
  };

  const removeCourier = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    setRemoveError('');
    try {
      const signer = wallet.assertCanWrite();
      const contract = getContract(wallet.deployment.contractAddress, signer);
      const tx = await contract.removeLogisticsUser(removeTarget.address);
      await tx.wait();
      await refreshAll();
      toast.success(
        'Courier role removed',
        removeTarget.active
          ? 'Their active orders should be reassigned. Past key grants remain on-chain.'
          : 'The wallet no longer has the courier role.'
      );
      setRemoveTarget(null);
    } catch (cause) {
      setRemoveError(humanizeError(cause).message);
    } finally {
      setRemoving(false);
    }
  };

  if (couriersLoading && !couriers.length) {
    return <PageSkeleton title="Loading team" />;
  }

  const filteredCustomers = customers.filter((customer) => {
    if (!customerSearch.trim()) return true;
    const needle = customerSearch.trim().toLowerCase();
    return (
      customer.displayName.toLowerCase().includes(needle) ||
      customer.address.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="page">
      <PageHeader
        title="Team"
        subtitle="Couriers, customers and admins. Roles are enforced by the contract; encryption keys are registered by each wallet."
        actions={
          <Badge tone="neutral" icon={ShieldCheck}>
            Admin only
          </Badge>
        }
      />

      <div className="stat-grid">
        <StatCard label="Couriers" value={couriers.length} meta="With logistics role" icon={Users} tone="accent" />
        <StatCard label="Customers" value={customers.length} meta="Registered profiles" icon={Users} tone="neutral" />
        <StatCard label="Admins" value={admins.length} meta="Contract administrators" icon={ShieldCheck} tone="success" />
        <StatCard
          label="Vault keys"
          value={`${couriers.filter((c) => c.exists && c.publicKey !== '0x').length + admins.filter((a) => a.exists && a.publicKey !== '0x').length}/${couriers.length + admins.length}`}
          meta="Courier + admin keys"
          icon={KeyRound}
          tone="warn"
        />
      </div>

      <div className="team-grid">
        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title">Couriers</h2>
              <p className="card__subtitle">
                Removing the role does not revoke already wrapped keys. Reassign
                active orders first.
              </p>
            </div>
            <Badge tone="violet">{couriers.length} total</Badge>
          </div>
          {couriers.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Courier</th>
                    <th scope="col">Vault key</th>
                    <th scope="col">Active</th>
                    <th scope="col">Address</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {couriers.map((courier) => {
                    const active = activeFor(courier.address);
                    const ready = courier.exists && courier.publicKey !== '0x';
                    return (
                      <tr key={courier.address}>
                        <td>
                          <Entity
                            address={courier.address}
                            name={courier.name || shortAddress(courier.address)}
                            size="sm"
                          />
                        </td>
                        <td>
                          <Badge tone={ready ? 'green' : 'amber'}>
                            {ready ? 'Registered' : 'Missing'}
                          </Badge>
                        </td>
                        <td className="tabular">{active}</td>
                        <td>
                          <span className="mono text-sm">{shortAddress(courier.address)}</span>
                        </td>
                        <td className="table__actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRemoveTarget({
                                ...courier,
                                active,
                              });
                              setRemoveError('');
                            }}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No couriers yet"
              text="Grant the courier role to a wallet, then ask them to sign in once so their vault key is registered."
              compact
            />
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Add a courier</h2>
                <p className="card__subtitle">
                  The wallet gets the logistics role on-chain.
                </p>
              </div>
              <UserPlus size={16} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
            </div>
            <div className="card__body">
              <form onSubmit={addCourier} className="stack">
                <TextField
                  label="Courier wallet address"
                  value={address}
                  onChange={(event) => {
                    setAddress(event.target.value);
                    if (addError) setAddError('');
                  }}
                  placeholder="0x…"
                  className="mono"
                  error={addError || undefined}
                  hint="They must sign in once to register their encryption public key."
                  spellCheck="false"
                  autoComplete="off"
                />
                <Button type="submit" variant="primary" loading={adding} icon={UserPlus}>
                  Grant courier role
                </Button>
              </form>
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <div>
                <h2 className="card__title">Admins</h2>
                <p className="card__subtitle">
                  The deployer holds the default admin role.
                </p>
              </div>
            </div>
            <div className="card__body">
              <ul className="list">
                {admins.map((admin) => (
                  <li className="list__item" key={admin.address}>
                    <Avatar
                      name={admin.name || admin.address}
                      address={admin.address}
                      size="sm"
                    />
                    <div className="list__body">
                      <div className="list__title">
                        {admin.name || shortAddress(admin.address)}
                      </div>
                      <div className="list__sub mono">
                        {shortAddress(admin.address)}
                      </div>
                    </div>
                    <Badge tone={admin.exists ? 'green' : 'amber'}>
                      {admin.exists ? 'Key ready' : 'No key'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>

      <section className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Customers</h2>
            <p className="card__subtitle">
              Every wallet that has registered an encryption profile.
            </p>
          </div>
          <SearchInput
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="Search name or address…"
            label="Search customers"
          />
        </div>
        {filteredCustomers.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Orders</th>
                  <th scope="col">Delivered</th>
                  <th scope="col">Active</th>
                  <th scope="col">Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => {
                  const customerOrders = ordersFor(customer.address);
                  const delivered = customerOrders.filter(
                    (order) => order.status === 'Delivered'
                  ).length;
                  const active = customerOrders.filter(
                    (order) =>
                      order.status !== 'Delivered' && order.status !== 'Cancelled'
                  ).length;
                  return (
                    <tr key={customer.address}>
                      <td>
                        <Entity
                          address={customer.address}
                          name={customer.displayName || shortAddress(customer.address)}
                          size="sm"
                        />
                      </td>
                      <td className="tabular">{customerOrders.length}</td>
                      <td className="tabular">{delivered}</td>
                      <td className="tabular">{active}</td>
                      <td>
                        <span className="mono text-sm">{shortAddress(customer.address)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title={customerSearch ? 'No matching customers' : 'No customer profiles yet'}
            text={
              customerSearch
                ? 'Try a different name or address.'
                : 'A customer profile is created when a wallet registers its encryption key on first sign-in.'
            }
            compact
          />
        )}
      </section>

      <Modal
        open={Boolean(removeTarget)}
        onClose={removing ? () => {} : () => setRemoveTarget(null)}
        title="Remove courier role?"
        description="The contract role is revoked immediately."
        size="sm"
        closeOnBackdrop={!removing}
        hideClose={removing}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Cancel
            </Button>
            <Button variant="danger" onClick={removeCourier} loading={removing}>
              Remove role
            </Button>
          </>
        }
      >
        {removeTarget ? (
          <div className="stack">
            <div className="row">
              <Avatar
                name={removeTarget.name || removeTarget.address}
                address={removeTarget.address}
                size="sm"
              />
              <div>
                <div style={{ fontWeight: 500 }}>
                  {removeTarget.name || shortAddress(removeTarget.address)}
                </div>
                <div className="field__hint mono">{removeTarget.address}</div>
              </div>
            </div>
            {removeTarget.active > 0 ? (
              <Callout tone="warning" title={`${removeTarget.active} active assignment(s)`}>
                Reassign those orders first. The courier may already hold their
                order keys, and role removal does not rotate them.
              </Callout>
            ) : (
              <Callout tone="info">
                They will no longer be able to update shipments. Past key
                envelopes stay on-chain.
              </Callout>
            )}
            {removeError ? (
              <Callout tone="danger" role="alert">
                {removeError}
              </Callout>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
