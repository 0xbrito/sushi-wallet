const { ethers } = require("hardhat");
const {
  UNISWAP_INITIAL_WETH_RESERVE_ROPSTEN,
  UNISWAP_INITIAL_TOKEN_RESERVE,
} = require("../utils/config");
const getContracts = require("./contracts");

async function main() {
  const [deployer] = await ethers.getSigners();
  const { sushi, router } = await getContracts();

  await sushi
    .connect(deployer)
    .approve(router.address, UNISWAP_INITIAL_TOKEN_RESERVE);

  const tx = await router.connect(deployer).addLiquidityETH(
    sushi.address, // tokenA
    UNISWAP_INITIAL_TOKEN_RESERVE, // amountTokenDesired
    0, // amountTokenMin
    0, // amountETHMin
    deployer.address, // to
    (await ethers.provider.getBlock("latest")).timestamp * 2, // deadline
    { value: UNISWAP_INITIAL_WETH_RESERVE_ROPSTEN }
  );
  console.log("Sending tx:", tx.hash);

  console.log("Waiting...");
  const rc = await tx.wait();
  console.log("tx cofirmed at block number: ", rc.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
