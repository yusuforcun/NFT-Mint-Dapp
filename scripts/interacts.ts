import hre from "hardhat";

async function main(){
    const {ethers} = await hre.network.connect();
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log("Using address:",deployerAddress);

    // Replace with your own addresses from deploy output (npx hardhat run scripts/deploy.ts --network localhost)
    const governanceTokenAddress = "0x0000000000000000000000000000000000000001";
    const votingAddress = "0x0000000000000000000000000000000000000002";

    const token = await ethers.getContractAt("GovernanceToken",governanceTokenAddress , deployer);
    const voting = await ethers.getContractAt("Voting",votingAddress,deployer);

    const balance = await token.balanceOf(deployerAddress);
    console.log("Deployer GOV balance:",balance.toString());

    const createTx = await voting.createProposal("Test proposal :Update  DAO parameters",60);
    const createRcpt = await createTx.wait();
    const proposalId = (await voting.nextProposalId())- 1n ;
    console.log("Created proposal with id:",proposalId.toString());

    const voteTx = await voting.vote(proposalId,true);
    await voteTx.wait();
    console.log("Voted Yes");

    await ethers.provider.send("evm_increaseTime",[120]);
    await ethers.provider.send("evm_mine",[]);

    const finalizeTx = await voting.finalize(proposalId);
    await finalizeTx.wait();
    console.log("Finalized proposal");
    
    const proposal = await voting.proposals(proposalId);
    console.log("Yes Votes :" , proposal.yesVotes.toString());
    console.log("No votes:", proposal.noVotes.toString());

}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});