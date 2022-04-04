const { ethers } = require("hardhat");
const getContracts = require("./deployedContracts");

async function main() {
  console.log("loading data...");
  const [, user] = await ethers.getSigners();

  const { wallet } = await getContracts();

  console.log("wallet: ", wallet.address);
  console.log("router: ", await wallet.connect(user).router());
  console.log("masterChef: ", await wallet.connect(user).chef());

  const pending = ethers.utils.formatEther(
    await wallet.connect(user).pending(0)
  );
  const staked = ethers.utils.formatEther(await wallet.connect(user).staked(0));
  console.log("pending tokens: ", pending);
  console.log("staked LPs: ", staked);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
