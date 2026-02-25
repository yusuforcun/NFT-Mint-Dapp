import { ethers } from "ethers";

// Replace with your own deployed contract addresses (see CALISTIRMA.md).
// After deploy, copy GovernanceToken and Voting addresses here.
export const GOVERNANCE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000001";
export const VOTING_ADDRESS = "0x0000000000000000000000000000000000000002";

// Minimal ABIs (only what we use)
export const governanceTokenAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
];

export const votingAbi = [
  "function createProposal(string description, uint256 votingPeriod) returns (uint256)",
  "function vote(uint256 proposalId, bool support)",
  "function finalize(uint256 proposalId)",
  "function nextProposalId() view returns (uint256)",
  "function proposals(uint256) view returns (uint256 id,string description,uint256 startTime,uint256 endTime,uint256 yesVotes,uint256 noVotes,bool finalized)",
  "event ProposalCreated(uint256 id,address proposer,string description,uint256 startTime,uint256 endTime)",
  "event VoteCast(uint256 proposalId,address voter,bool support,uint256 weight)",
  "event ProposalFinalized(uint256 proposalId,bool passed,uint256 yesVotes,uint256 noVotes)",
];

declare global {
  interface Window {
    ethereum?: unknown;
  }
}

export function getProvider() {
  if (typeof window === "undefined" || !window.ethereum) throw new Error("MetaMask not found");
  return new ethers.BrowserProvider(window.ethereum as import("ethers").Eip1193Provider);
}