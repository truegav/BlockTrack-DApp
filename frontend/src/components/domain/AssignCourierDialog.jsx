import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getBytes } from 'ethers';
import { KeyRound } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { getContract, humanizeError } from '../../lib/contract.js';
import { shortAddress } from '../../lib/format.js';
import { wrapOrderKey } from '../../shared/crypto.js';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { Callout } from '../ui/Callout.jsx';
import { Modal } from '../ui/Modal.jsx';

const ZERO = '0x0000000000000000000000000000000000000000';

export function AssignCourierDialog({ open, onClose, order, couriers, orders = [] }) {
  const { session } = useOutletContext();
  const wallet = session.wallet;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const workload = (address) =>
    orders.filter(
      (item) =>
        item.status !== 'Delivered' &&
        item.status !== 'Cancelled' &&
        item.courier?.toLowerCase() === address.toLowerCase()
    ).length;

  useEffect(() => {
    if (!open) return;
    setSelected(order.courier && order.courier !== ZERO ? order.courier : '');
    setError('');
    setSaving(false);
  }, [open, order.id, order.courier]);

  const submit = async () => {
    const courier = couriers.find(
      (item) => item.address.toLowerCase() === selected.toLowerCase()
    );
    if (!courier) {
      setError('Choose a courier.');
      return;
    }
    if (!courier.exists || !courier.publicKey || courier.publicKey === '0x') {
      setError('That courier has not unlocked their vault yet.');
      return;
    }
    if (!order.orderKey) {
      setError('This browser has no order key for the shipment.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const signer = wallet.assertCanWrite();
      const contract = getContract(wallet.deployment.contractAddress, signer);
      const wrapped = wrapOrderKey(order.orderKey, getBytes(courier.publicKey));
      const tx = await contract.assignCourier(order.id, courier.address, wrapped);
      await tx.wait();
      await queryClient.invalidateQueries({ queryKey: ['order'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['couriers'] });
      toast.success(
        'Courier assigned',
        `${courier.name || shortAddress(courier.address)} can now decrypt this order.`
      );
      onClose();
    } catch (cause) {
      const human = humanizeError(cause);
      setError(human.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={
        order.courier && order.courier !== ZERO
          ? 'Reassign courier'
          : 'Assign a courier'
      }
      description="The order key is unwrapped locally and rewrapped for the courier's registered public key."
      closeOnBackdrop={!saving}
      hideClose={saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={saving}
            icon={KeyRound}
          >
            Assign courier
          </Button>
        </>
      }
    >
      {couriers.length ? (
        <div className="courier-options">
          {couriers.map((courier) => {
            const ready =
              courier.exists && courier.publicKey && courier.publicKey !== '0x';
            const current =
              order.courier?.toLowerCase() === courier.address.toLowerCase();
            return (
              <label
                className={`courier-option ${!ready ? 'courier-option--disabled' : ''}`.trim()}
                key={courier.address}
              >
                <input
                  type="radio"
                  name="courier"
                  value={courier.address}
                  checked={selected.toLowerCase() === courier.address.toLowerCase()}
                  onChange={() => setSelected(courier.address)}
                  disabled={!ready}
                />
                <Avatar
                  name={courier.name || courier.address}
                  address={courier.address}
                  size="sm"
                />
                <span className="courier-option__body">
                  <span className="courier-option__name">
                    {courier.name || shortAddress(courier.address)}
                    {current ? <span className="tag">Current</span> : null}
                  </span>
                  <span className="courier-option__meta">
                    {shortAddress(courier.address)} · {workload(courier.address)}{' '}
                    active
                    {!ready ? ' · vault not initialized' : ''}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <Callout tone="warning" title="No couriers yet">
          Add a courier in Team and ask them to sign in once so their encryption
          key is registered.
        </Callout>
      )}

      {order.courier && order.courier !== ZERO ? (
        <div style={{ marginTop: 14 }}>
          <Callout tone="warning" title="Reassignment removes the previous grant">
            The old courier loses the on-chain key envelope. If they already
            decrypted the order, they may retain a copy — true revocation needs
            key rotation.
          </Callout>
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 14 }}>
          <Callout tone="danger" role="alert" title="Assignment failed">
            {error}
          </Callout>
        </div>
      ) : null}
    </Modal>
  );
}
