import { useEffect, useState } from "react";
import {
  GOVERNANCE_TOKEN_ADDRESS,
  VOTING_ADDRESS,
  governanceTokenAbi,
  votingAbi,
  getProvider,
} from "./contracts";
import { ethers } from "ethers";

type Proposal = {
  id: bigint;
  description: string;
  yesVotes: bigint;
  noVotes: bigint;
  finalized: boolean;
};

function App() {
  const [account, setAccount] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [proposalDesc, setProposalDesc] = useState("");
  const [proposalIdInput, setProposalIdInput] = useState("");
  const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  async function connectWallet() {
    setError("");
    try {
      const provider = getProvider();
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
      await loadBalance(accounts[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    }
  }

  async function loadBalance(addr?: string) {
    if (!addr && !account) return;
    setError("");
    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const token = new ethers.Contract(
        GOVERNANCE_TOKEN_ADDRESS,
        governanceTokenAbi,
        signer
      );
      const b = await token.balanceOf(addr ?? account);
      setBalance(ethers.formatUnits(b, 18));
    } catch (e) {
      setBalance("0");
      setError(
        "Contract not found at configured address. Did you restart the node? Run: npx hardhat node, then deploy with --network localhost and update addresses in frontend/src/contracts.ts"
      );
    }
  }

  async function createProposal() {
    if (!proposalDesc) return;
    setLoading(true);
    setError("");
    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const voting = new ethers.Contract(VOTING_ADDRESS, votingAbi, signer);
      const tx = await voting.createProposal(proposalDesc, 60);
      await tx.wait();
      setProposalDesc("");
      alert("Proposal created");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create proposal failed. Check that the node is running and addresses in contracts.ts are correct.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProposal() {
    if (!proposalIdInput) return;
    setError("");
    setCurrentProposal(null);
    const id = BigInt(proposalIdInput);
    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const voting = new ethers.Contract(VOTING_ADDRESS, votingAbi, signer);
      const p = await voting.proposals(id);
      if (p.endTime === 0n) {
        setError("Proposal does not exist for this ID.");
        return;
      }
      setCurrentProposal({
        id: p.id,
        description: p.description,
        yesVotes: p.yesVotes,
        noVotes: p.noVotes,
        finalized: p.finalized,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("not a contract") || msg.includes("BAD_DATA") || msg.includes("could not decode")) {
        setError("Voting contract not found at this address. Restart the node? Then run: npx hardhat run scripts/deploy.ts --network localhost and update GOVERNANCE_TOKEN_ADDRESS and VOTING_ADDRESS in frontend/src/contracts.ts");
      } else {
        setError("Load failed: " + msg);
      }
    }
  }

  async function vote(support: boolean) {
    if (!proposalIdInput) return;
    setLoading(true);
    setError("");
    try {
      const id = BigInt(proposalIdInput);
      const provider = getProvider();
      const signer = await provider.getSigner();
      const voting = new ethers.Contract(VOTING_ADDRESS, votingAbi, signer);
      const tx = await voting.vote(id, support);
      await tx.wait();
      await loadProposal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setLoading(false);
    }
  }

  async function finalize() {
    if (!proposalIdInput) return;
    setLoading(true);
    setError("");
    try {
      const id = BigInt(proposalIdInput);
      const provider = getProvider();
      const signer = await provider.getSigner();
      const voting = new ethers.Contract(VOTING_ADDRESS, votingAbi, signer);
      const tx = await voting.finalize(id);
      await tx.wait();
      await loadProposal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Finalize failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // optional: try auto-connect here
  }, []);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 24 }}>
      <h1>On-chain Voting / DAO</h1>

      {error && (
        <div style={{ padding: 12, marginBottom: 12, background: "#fee", color: "#c00", borderRadius: 8 }}>
          {error}
        </div>
      )}

      <section>
        <button onClick={connectWallet}>
          {account ? "Wallet connected" : "Connect wallet"}
        </button>
        {account && (
          <div>
            <div>Address: {account}</div>
            <div>GOV Balance: {balance}</div>
          </div>
        )}
      </section>

      <hr />

      <section>
        <h2>Create new proposal</h2>
        <input
          type="text"
          placeholder="Description"
          value={proposalDesc}
          onChange={(e) => setProposalDesc(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <button onClick={createProposal} disabled={loading}>
          Create (60s)
        </button>
      </section>

      <hr />

      <section>
        <h2>View proposal / Vote</h2>
        <input
          type="number"
          placeholder="Proposal ID"
          value={proposalIdInput}
          onChange={(e) => setProposalIdInput(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <button onClick={loadProposal}>Load</button>

        {currentProposal && (
          <div style={{ marginTop: 12 }}>
            <div>ID: {currentProposal.id.toString()}</div>
            <div>Description: {currentProposal.description}</div>
            <div>
              Yes: {ethers.formatUnits(currentProposal.yesVotes, 18)} / No:{" "}
              {ethers.formatUnits(currentProposal.noVotes, 18)}
            </div>
            <div>Finalized: {currentProposal.finalized ? "Yes" : "No"}</div>

            <button onClick={() => vote(true)} disabled={loading}>
              YES
            </button>
            <button onClick={() => vote(false)} disabled={loading}>
              NO
            </button>
            <button onClick={finalize} disabled={loading}>
              Finalize
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;