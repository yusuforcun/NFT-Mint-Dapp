import { expect } from "chai";
import hre from "hardhat";

/**
 * Gas measurement for main flows.
 * Run: npx hardhat test test/Voting.gas.test.ts
 * Numbers are environment-dependent; use for relative comparison.
 */
describe("Voting [gas]", function () {
  it("measures gas: deploy token + voting, createProposal, vote, finalize", async function () {
    const { ethers } = await hre.network.connect();
    const [deployer, voter2] = await ethers.getSigners();

    const govFactory = await ethers.getContractFactory("GovernanceToken", deployer);
    const tokenContract = await govFactory.deploy(1_000_000n);
    const tokenDeployTx = tokenContract.deploymentTransaction();
    await tokenContract.waitForDeployment();
    if (tokenDeployTx) {
      const tokenDeployReceipt = await tokenDeployTx.wait();
      if (tokenDeployReceipt) console.log("  GovernanceToken deploy gas:", tokenDeployReceipt.gasUsed.toString());
    }

    const govAddress = await tokenContract.getAddress();

    const votingFactory = await ethers.getContractFactory("Voting", deployer);
    const votingContract = await votingFactory.deploy(govAddress);
    const votingDeployTx = votingContract.deploymentTransaction();
    await votingContract.waitForDeployment();
    if (votingDeployTx) {
      const votingDeployReceipt = await votingDeployTx.wait();
      if (votingDeployReceipt) console.log("  Voting deploy gas:", votingDeployReceipt.gasUsed.toString());
    }

    const voting = await ethers.getContractAt("Voting", await votingContract.getAddress(), deployer);
    const token = await ethers.getContractAt("GovernanceToken", govAddress, deployer);

    const half = (await token.balanceOf(await deployer.getAddress())) / 2n;
    await (await token.transfer(await voter2.getAddress(), half)).wait();

    const createTx = await voting.createProposal("Test proposal", 60);
    const createReceipt = await createTx.wait();
    expect(createReceipt).to.not.be.null;
    console.log("  createProposal gas:", createReceipt!.gasUsed.toString());

    const proposalId = (await voting.nextProposalId()) - 1n;

    const vote1Tx = await voting.vote(proposalId, true);
    const vote1Receipt = await vote1Tx.wait();
    console.log("  vote (first) gas:", vote1Receipt!.gasUsed.toString());

    const vote2Tx = await voting.connect(voter2).vote(proposalId, false);
    const vote2Receipt = await vote2Tx.wait();
    console.log("  vote (second) gas:", vote2Receipt!.gasUsed.toString());

    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine", []);

    const finalizeTx = await voting.finalize(proposalId);
    const finalizeReceipt = await finalizeTx.wait();
    console.log("  finalize gas:", finalizeReceipt!.gasUsed.toString());
  });
});
