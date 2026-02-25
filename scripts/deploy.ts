import hre from "hardhat";

async function main() {
  // Hardhat 3: connect to network and get ethers from here
  const { ethers } = await hre.network.connect();

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", await deployer.getAddress());

  // 1) Deploy GovernanceToken – 1_000_000 initial supply
  const GovernanceToken = await ethers.getContractFactory("GovernanceToken", deployer);
  const governanceToken = await GovernanceToken.deploy(1_000_000n);
  await governanceToken.waitForDeployment();
  const govAddress = await governanceToken.getAddress();
  console.log("GovernanceToken deployed to:", govAddress);

  // 2) Deploy Voting contract – pass token address
  const Voting = await ethers.getContractFactory("Voting", deployer);
  const voting = await Voting.deploy(govAddress);
  await voting.waitForDeployment();
  const votingAddress = await voting.getAddress();
  console.log("Voting deployed to:", votingAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});