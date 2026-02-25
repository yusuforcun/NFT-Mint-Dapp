import { expect } from "chai";
import hre from "hardhat";

describe("Voting", () => {
  async function deployFixture() {
    const { ethers } = await hre.network.connect();
    const [deployer, voter2, voter3] = await ethers.getSigners();
    const GovernanceToken = await ethers.getContractFactory("GovernanceToken", deployer);
    const governanceToken = await GovernanceToken.deploy(1_000_000n);
    await governanceToken.waitForDeployment();
    const govAddress = await governanceToken.getAddress();
    const Voting = await ethers.getContractFactory("Voting", deployer);
    const voting = await Voting.deploy(govAddress);
    await voting.waitForDeployment();
    return { ethers, deployer, voter2, voter3, governanceToken, voting };
  }

  it("create proposal and vote and finalize", async () => {
    const { ethers, deployer, voter2, governanceToken, voting } = await deployFixture();
    const half = (await governanceToken.balanceOf(await deployer.getAddress())) / 2n;
    await (await governanceToken.transfer(await voter2.getAddress(), half)).wait();

    const createTx = await voting.createProposal("Test proposal", 60);
    await createTx.wait();
    const proposalId = (await voting.nextProposalId()) - 1n;

    const proposal = await voting.proposals(proposalId);
    expect(proposal.description).to.equal("Test proposal");

    await (await voting.vote(proposalId, true)).wait();
    await (await voting.connect(voter2).vote(proposalId, false)).wait();

    const storedProposal = await voting.proposals(proposalId);
    expect(storedProposal.yesVotes + storedProposal.noVotes).to.equal(
      await governanceToken.totalSupply()
    );
    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine", []);

    await (await voting.finalize(proposalId)).wait();

    const finalized = await voting.proposals(proposalId);
    expect(finalized.finalized).to.equal(true);
  });

  describe("edge cases", () => {
    it("reverts when voting on non-existent proposal", async () => {
      const { voting } = await deployFixture();
      const badId = 999n;
      await expect(voting.vote(badId, true)).to.be.revertedWith("Proposal does not exist");
    });

    it("reverts when finalizing non-existent proposal", async () => {
      const { voting } = await deployFixture();
      await expect(voting.finalize(999n)).to.be.revertedWith("Proposal does not exist");
    });

    it("reverts when same user votes twice", async () => {
      const { deployer, governanceToken, voting } = await deployFixture();
      await (await voting.createProposal("Double vote test", 60)).wait();
      const proposalId = (await voting.nextProposalId()) - 1n;
      await (await voting.vote(proposalId, true)).wait();
      await expect(voting.vote(proposalId, false)).to.be.revertedWith("Already voted");
    });

    it("reverts when voter has zero token balance", async () => {
      const { voter2, governanceToken, voting } = await deployFixture();
      await (await voting.createProposal("Zero balance test", 60)).wait();
      const proposalId = (await voting.nextProposalId()) - 1n;
      await expect(voting.connect(voter2).vote(proposalId, true)).to.be.revertedWith("No voting power");
    });

    it("reverts when voting after period ended", async () => {
      const { ethers, deployer, governanceToken, voting } = await deployFixture();
      await (await voting.createProposal("After end test", 60)).wait();
      const proposalId = (await voting.nextProposalId()) - 1n;
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);
      await expect(voting.vote(proposalId, true)).to.be.revertedWith("Voting is not active");
    });

    it("reverts when finalizing before period ended", async () => {
      const { deployer, governanceToken, voting } = await deployFixture();
      await (await voting.createProposal("Early finalize test", 60)).wait();
      const proposalId = (await voting.nextProposalId()) - 1n;
      await (await voting.vote(proposalId, true)).wait();
      await expect(voting.finalize(proposalId)).to.be.revertedWith("Voting not ended");
    });

    it("reverts when finalizing twice", async () => {
      const { ethers, deployer, governanceToken, voting } = await deployFixture();
      await (await voting.createProposal("Double finalize test", 60)).wait();
      const proposalId = (await voting.nextProposalId()) - 1n;
      await (await voting.vote(proposalId, true)).wait();
      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);
      await (await voting.finalize(proposalId)).wait();
      await expect(voting.finalize(proposalId)).to.be.revertedWith("Already finalized");
    });

    it("tie (yesVotes == noVotes) results in passed == false", async () => {
      const { ethers, deployer, voter2, governanceToken, voting } = await deployFixture();
      const half = (await governanceToken.balanceOf(await deployer.getAddress())) / 2n;
      await (await governanceToken.transfer(await voter2.getAddress(), half)).wait();
      await (await voting.createProposal("Tie test", 60)).wait();
      const proposalId = (await voting.nextProposalId()) - 1n;
      await (await voting.vote(proposalId, true)).wait();
      await (await voting.connect(voter2).vote(proposalId, false)).wait();
      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);
      const finalizeTx = await voting.finalize(proposalId);
      await expect(finalizeTx).to.emit(voting, "ProposalFinalized").withArgs(proposalId, false, half, half);
      const p = await voting.proposals(proposalId);
      expect(p.finalized).to.equal(true);
      expect(p.yesVotes).to.equal(p.noVotes);
    });

    it("reverts when createProposal has zero voting period", async () => {
      const { voting } = await deployFixture();
      await expect(voting.createProposal("No period", 0)).to.be.revertedWith("Voting period must be > 0");
    });
  });
});