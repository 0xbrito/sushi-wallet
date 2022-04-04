const { ethers } = require("hardhat");
const getContracts = require("./deployedContracts");

async function main() {
  console.log("loading data...");
  const [, user] = await ethers.getSigners();

  const { wallet } = await getContracts();

  console.log("wallet: ", wallet.address);
  console.log("router: ", await wallet.connect(user).router());
  console.log("masterChef: ", await wallet.connect(user).chef());

  const pid = 0;

  const pending = ethers.utils.formatEther(
    await wallet.connect(user).pending(pid)
  );
  const staked = ethers.utils.formatEther(
    await wallet.connect(user).staked(pid)
  );
  console.log(`pending tokens in pool ${pid}: `, pending);
  console.log(`staked LPs in pool ${pid}: `, staked);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
