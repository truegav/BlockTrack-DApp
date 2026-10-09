# BlockTrack — Minimal PoC (Foundry, local only)

Admin creates parcels, logistics updates status on-chain, anyone reads history.
Built with Foundry (`forge`/`cast`/`anvil`). No Hardhat, no npm at root, no Sepolia.

## Layout
- `src/BlockTrack.sol` — 1 contract (OpenZeppelin AccessControl)
- `test/BlockTrack.t.sol` — 5 forge tests ✅ (all passing)
- `script/Deploy.s.sol` — local deploy script
- `frontend/` — minimal Vite React UI (Track / Admin / Logistics)

## Contract (minimal)
Roles: Admin, Logistics, public read.
`createParcel()` · `updateParcelStatus()` · `getParcel()` · `getTrackingHistory()` · `add/removeLogisticsUser()`
Statuses: Created → PickedUp → InTransit → OutForDelivery → Delivered / Cancelled

## Local test (Foundry only)
```bash
forge build
forge test
```

## Local demo (anvil, 2 terminals)
```bash
# terminal 1
anvil
# terminal 2
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --unlocked --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
# copy deployed address, then E2E:
cast send <ADDR> "createParcel(string)" "BT1001" --rpc-url http://127.0.0.1:8545 --unlocked --from 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
cast send <ADDR> "addLogisticsUser(address)" 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 --rpc-url http://127.0.0.1:8545 --unlocked --from 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
cast send <ADDR> "updateParcelStatus(string,uint8,string)" "BT1001" 2 "left hub" --rpc-url http://127.0.0.1:8545 --unlocked --from 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
cast call <ADDR> "getParcel(string)" "BT1001" --rpc-url http://127.0.0.1:8545
cast call <ADDR> "getTrackingHistory(string)" "BT1001" --rpc-url http://127.0.0.1:8545
```

Frontend (optional, needs npm once): paste local address into
`frontend/src/config.js`, then `cd frontend && npm install && npm run dev`
with MetaMask pointed at `http://127.0.0.1:8545` (chain 31337).

## Viva demo (1 min)
1. `forge test` → 5 passed
2. Create `BT1001` as admin ✅
3. Add logistics ✅
4. Update to InTransit as logistics ✅ (stranger reverts `not authorized`)
5. `getTrackingHistory` → timeline with updater + timestamp ✅

Limits by design: no payments, GPS, tokens, or real courier integration.
