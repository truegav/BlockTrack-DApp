/**
 * Local demo personas.
 *
 * These are the standard, publicly known Anvil development keys. They hold no
 * value and exist only so the local demo can sign transactions without requiring
 * MetaMask account imports. The app only exposes them when the configured chain
 * is 31337 and the deployment marks itself as a demo.
 *
 * Never reuse these keys on a real network.
 */

export const DEMO_CHAIN_ID = 31337;

export const DEMO_PERSONAS = [
  {
    id: 'admin',
    name: 'Maya Sharma',
    role: 'admin',
    title: 'Operations lead',
    city: 'Bengaluru',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey:
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  },
  {
    id: 'courier-arjun',
    name: 'Arjun Kapoor',
    role: 'courier',
    title: 'Courier · Bengaluru',
    city: 'Bengaluru',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey:
      '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
  {
    id: 'courier-priya',
    name: 'Priya Nair',
    role: 'courier',
    title: 'Courier · Mumbai',
    city: 'Mumbai',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey:
      '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  },
  {
    id: 'customer-rohan',
    name: 'Rohan Mehta',
    role: 'customer',
    title: 'Customer · Bengaluru',
    city: 'Bengaluru',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey:
      '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  },
  {
    id: 'customer-ananya',
    name: 'Ananya Iyer',
    role: 'customer',
    title: 'Customer · Mumbai',
    city: 'Mumbai',
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    privateKey:
      '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  },
  {
    id: 'customer-kabir',
    name: 'Kabir Shah',
    role: 'customer',
    title: 'Customer · Delhi',
    city: 'Delhi',
    address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    privateKey:
      '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  },
];

export const DEMO_BY_ID = Object.fromEntries(
  DEMO_PERSONAS.map((persona) => [persona.id, persona])
);

export const DEMO_BY_ADDRESS = Object.fromEntries(
  DEMO_PERSONAS.map((persona) => [persona.address.toLowerCase(), persona])
);

export function personaForAddress(address = '') {
  return DEMO_BY_ADDRESS[address.toLowerCase()] || null;
}

export function initialsForName(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'courier') return 'Courier';
  return 'Customer';
}
