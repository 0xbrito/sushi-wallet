const { ethers } = require("hardhat");

async function main() {
  const [, user] = await ethers.getSigners();

  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
