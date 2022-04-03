const { ethers } = require("hardhat");
const getContracts = require("./contracts");

async function main() {
  const [deployer] = await ethers.getSigners();

  const { chef, sushi, pair } = await getContracts();

  await sushi.connect(deployer).transferOwnership(chef.address);
  const tx = await chef.connect(deployer).add("100", pair.address, true);
  const rc = await tx.wait();
  console.log("confirmed at block:", rc.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
