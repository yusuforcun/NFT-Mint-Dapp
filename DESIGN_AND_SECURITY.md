# Design, Security & Tradeoffs

This document answers common design and security questions for this on-chain voting project.

---

## 1. Attack surface

| Component | Risk | Mitigation in this project |
|-----------|------|----------------------------|
| **GovernanceToken** | Unlimited mint → inflation of voting power | No `mint()`; fixed supply at deploy. |
| **GovernanceToken** | Transfer to zero address | `require(_to != address(0))`. |
| **GovernanceToken** | Overflow/underflow | Solidity 0.8+ built-in checks. |
| **Voting** | Vote weight = current balance (no snapshot at proposal start) | By design: we use “vote-time” snapshot (weight at `vote()`). Attacker can buy tokens, vote, then sell; acceptable for a simple demo. Production would use a snapshot at proposal creation or ERC20Snapshot. |
| **Voting** | Double vote | `require(!voter.voted)` per proposal per address. |
| **Voting** | Vote outside time window | Checks `startTime <= now <= endTime` and `now > endTime` for finalize. |
| **Voting** | Finalize twice | `require(!proposal.finalized)`. |
| **Voting** | Non-existent proposal (e.g. id never created) | `proposal.endTime != 0` used as “exists” check. |
| **Voting** | Griefing via many proposals | Anyone can create; no deposit. Production: proposal threshold or fee. |
| **Voting** | Description length / gas DoS | Unbounded `string`; very long description could make `createProposal` expensive. Production: cap length or use IPFS hash. |

---

## 2. Gas measurement

Gas is measured in `test/Voting.gas.test.ts`. Run: `npx hardhat test test/Voting.gas.test.ts`. Typical relative order:

- **GovernanceToken.deploy**: highest (one-time).
- **Voting.deploy**: one-time, depends on token address.
- **createProposal**: SLOADs + one SSTORE for Proposal + event; grows with `_description` length.
- **vote**: SLOADs (proposal, voterInfo, balanceOf) + SSTOREs (voterInfo, yesVotes/noVotes) + external call to token; usually the most expensive per-user action.
- **finalize**: SLOADs + one SSTORE (finalized) + event; cheap.

Exact numbers depend on compiler and network; run `npx hardhat test test/Voting.gas.test.ts` to see reported values.

---

## 3. Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| **Snapshot at vote time** | Simpler; no need for token to expose historical balance. Downside: vote-buying (buy → vote → sell) is possible. |
| **No quorum** | Simple; any yes/no margin wins. Downside: low turnout can pass proposals. |
| **No timelock / execution** | Only “vote and record result”; no on-chain execution. Simpler, but no automatic execution of outcomes. |
| **Anyone can create proposal** | Permissionless; easy to spam. Production: threshold (e.g. min token balance) or fee. |
| **Unbounded proposal description** | Flexible; cost and DoS risk if description is huge. Production: limit length or use bytes32/IPFS. |
| **No AccessControl / Ownable** | No admin; fully permissionless. Simpler, but no way to upgrade or pause. |

---

## 4. Edge cases (and how we test them)

- **Proposal does not exist**: `proposals(id)` with never-created id → `endTime == 0`; finalize/vote revert. (Test: vote/finalize on non-existent id.)
- **Vote before start / after end**: Revert “Voting is not active” or “Voting not ended”. (Test: `evm_increaseTime` and call vote/finalize at boundaries.)
- **Double vote**: Revert “Already voted”. (Test: same user votes twice.)
- **Zero voting power**: Revert “No voting power”. (Test: address with zero token balance votes.)
- **Finalize twice**: Revert “Already finalized”. (Test: call finalize twice.)
- **Tie (yesVotes == noVotes)**: `passed == false`; no revert. (Test: equal yes/no and check result.)
- **Very long description**: Allowed; gas cost rises. (Test: optional gas snapshot for long string.)

See `test/Voting.test.ts` for the edge-case tests.

---

## 5. “In production, what would I change?”

- **Token**
  - Add **AccessControl** (or at least a restricted **mint** role) so new tokens are only created by a known policy (e.g. multisig), not left to a single key.
  - Consider **ERC20Snapshot** (or equivalent) so voting weight is based on balance at a fixed block (e.g. proposal creation), not at vote time.
  - Add **pause** capability (e.g. via AccessControl) for incident response.
- **Voting**
  - **Proposal creation**: Require minimum balance or deposit, or cap description length / use IPFS.
  - **Quorum**: Require minimum total weight (e.g. yes + no ≥ supply * 20%) for `passed` to be true.
  - **Timelock + execution**: After a proposal passes, enforce a delay and then allow execution of a calldata (e.g. against a target contract) instead of only emitting an event.
  - **Upgradeability**: If using a proxy, make sure storage layout is append-only and documented (see below).

---

## 6. Why AccessControl instead of Ownable?

- **Ownable**: Single `owner`; simple but all power in one key. Lost key or compromise = full control.
- **AccessControl**: Role-based (e.g. `MINTER_ROLE`, `PAUSER_ROLE`, `DEFAULT_ADMIN_ROLE`). You can:
  - Give mint only to a multisig or timelock.
  - Revoke one role without changing others.
  - Use multiple roles for different actions (mint, pause, upgrade).

So we’d choose **AccessControl** in production to avoid a single point of failure and to align with multisig/timelock for sensitive actions (e.g. mint).

---

## 7. If mint were tied to a multisig, what would change?

- **GovernanceToken** would have a `mint(to, amount)` (or similar) restricted to a role (e.g. `MINTER_ROLE`) held by a **multisig** contract (e.g. Gnosis Safe).
- **Effects**:
  - No single key can inflate supply; minting requires M-of-N signatures.
  - Slower and more costly (multisig execution) for each mint.
  - Token supply can still grow over time in a controlled way (rewards, grants, etc.) under DAO or governance policy.

So: “We didn’t add mint in this repo to keep the demo fixed-supply; in production we’d add a restricted mint and give that role to a multisig.”

---

## 8. If we made it upgradeable, how would storage layout be affected?

- We’d use an **upgradeable proxy** (e.g. UUPS or TransparentProxy) so the logic contract can be replaced while storage lives in the proxy.
- **Storage layout rules**:
  - New logic contract must **never** change the order, type, or size of existing storage variables.
  - Only **append** new variables at the end (and respect inheritance layout if using OpenZeppelin’s storage gaps).
- **This project**:
  - **GovernanceToken**: `name`, `symbol`, `decimals`, `totalSupply`, `balanceOf` (and any inherited storage). A new version could add e.g. `mapping(address => uint256) public nonces` for EIP-2612 only at the end.
  - **Voting**: `governanceToken`, `nextProposalId`, `proposals`, `voterInfo`. Any new version must keep these in the same order and add new state only after.

If we reordered or removed a field, existing storage would be read incorrectly and the contract could break or become insecure.

---

## 9. Why we didn’t add Permit (EIP-2612)

- **Tradeoff**:
  - **Pro**: Gasless approvals; users sign off-chain and a relayer (or the user in a later tx) submits `permit` + action in one go. Better UX.
  - **Con**: This project focuses on **governance voting**, not token transfers/approvals in the UI. The Voting contract only needs `balanceOf`; it doesn’t use `approve`/`transferFrom`. So Permit doesn’t simplify the current voting flow.
  - **Con**: EIP-2612 adds `nonces`, `DOMAIN_SEPARATOR`, and `permit()`; more code and surface (e.g. replay across forks/chains if not careful).
- **Answer**: “We didn’t add Permit because voting doesn’t use approvals, and we wanted to keep the token minimal. For a token that’s also used in DeFi or gasless flows, we’d add EIP-2612 and document chain/domain separation.”

---

## 10. Summary table

| Question | Short answer |
|----------|--------------|
| Attack surface | Fixed supply, no mint; vote-time snapshot; double-vote and time bounds enforced. |
| Gas | Measured in tests; vote > createProposal > finalize. |
| Tradeoffs | Vote-time snapshot vs snapshot-at-proposal; no quorum; no execution; no admin. |
| Edge cases | Non-existent proposal, double vote, zero power, finalize twice, tie; all covered in tests. |
| Production changes | AccessControl + restricted mint, snapshot/quorum/timelock/execution, proposal limits. |
| AccessControl vs Ownable | AccessControl for roles (e.g. multisig minter); avoid single-owner. |
| Multisig mint | Mint role to multisig; controlled inflation, no single key. |
| Upgradeable storage | Append-only layout; same order and types; new vars at end. |
| No Permit | Voting doesn’t use approvals; keep token minimal; add Permit if we need gasless approvals. |
