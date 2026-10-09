// Local Anvil default. Redeploying on a FRESH anvil with the default
// unlocked account always yields this address (first tx, nonce 0).
// If you deploy differently, paste your address here.
export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const RPC_URL = "http://127.0.0.1:8545";
export const CHAIN_ID = 31337; // anvil

export const CONTRACT_ABI = [
  "function createParcel(string trackingId)",
  "function updateParcelStatus(string trackingId, uint8 newStatus, string note)",
  "function getParcel(string trackingId) view returns (string id, address creator, uint8 currentStatus, uint256 createdAt, bool exists)",
  "function getTrackingHistory(string trackingId) view returns (tuple(uint8 status, uint256 timestamp, address updatedBy, string note)[])",
  "function addLogisticsUser(address account)",
  "function removeLogisticsUser(address account)",
  "function isLogistics(address account) view returns (bool)",
  "function isAdmin(address account) view returns (bool)",
  "function parcelExists(string trackingId) view returns (bool)",
  "event ParcelCreated(string indexed trackingId, address indexed creator, uint256 timestamp)",
  "event StatusUpdated(string indexed trackingId, uint8 oldStatus, uint8 newStatus, address indexed updatedBy, uint256 timestamp, string note)"
];

export const STATUSES = ["Created", "Picked Up", "In Transit", "Out for Delivery", "Delivered", "Cancelled"];
// update uses index 1..5 (0 = Created, creation-only)
