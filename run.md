# How to Run and Test the Project

## Requirements
- Node.js (v18+)
- MetaMask (browser extension)

---

## 1. Install dependencies

In the project root (this folder):

```bash
npm install
```

For the frontend as well:

```bash
cd frontend
npm install
cd ..
```

---

## 2. Compile contracts

```bash
npx hardhat compile
```

On success you should see output like `Compiled 1 Solidity file`.

---

## 3. Run tests

```bash
npx hardhat test
```

- Only the `Voting` test runs (create proposal, vote, finalize).
- All tests should pass.

---

## 4. Local chain + deploy + script

**Terminal 1** – Start Hardhat node (keep it running):

```bash
npx hardhat node
```

**Terminal 2** – In the same project root:

Deploy:

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

Note the addresses from the output:
- `GovernanceToken deployed to: 0x...`
- `Voting deployed to: 0x...`

Optional: run the proposal + vote + finalize flow via script:

```bash
npx hardhat run scripts/interacts.ts --network localhost
```

**Important:** If you stop and restart the node, the chain resets. Redeploy and update the addresses in the frontend (step 6).

---

## 5. Run the frontend

```bash
cd frontend
npm run dev
```

Browser will open at `http://localhost:5173`.

---

## 6. Connect MetaMask to the local chain

1. In MetaMask go to **Networks** → **Add network** → **Add a network manually**.
2. Enter:
   - **Network name:** Hardhat Local
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - Currency: ETH (default is fine)
3. Save.

4. **First** ensure `npx hardhat node` is running.
5. **Then** run `npx hardhat run scripts/deploy.ts --network localhost` to deploy.
6. Update the **GovernanceToken** and **Voting** addresses in `frontend/src/contracts.ts`:
   - `GOVERNANCE_TOKEN_ADDRESS`
   - `VOTING_ADDRESS`

7. Use the first account in MetaMask (Hardhat’s test account). This account receives all GOV tokens on deploy.

---

## 7. What you can do from the frontend

1. **Connect wallet** – See your GOV balance.
2. **Create new proposal** – Enter a description and click “Create (60s)” to create a proposal.
3. **View proposal / Vote** – Enter proposal ID (0, 1, 2, …), click “Load” to fetch details. Vote YES/NO, then click “Finalize” when the voting period has ended.

---

## Quick summary (in order)

| Step | Command / Action |
|------|------------------|
| 1 | `npm install` (root) → `cd frontend && npm install` |
| 2 | `npx hardhat compile` |
| 3 | `npx hardhat test` |
| 4 | Terminal 1: `npx hardhat node` |
| 5 | Terminal 2: `npx hardhat run scripts/deploy.ts --network localhost` |
| 6 | Update addresses in `frontend/src/contracts.ts` |
| 7 | Add MetaMask network: `http://127.0.0.1:8545`, Chain ID `31337` |
| 8 | `cd frontend && npm run dev` → test in browser |
