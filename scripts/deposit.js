const { ethers } = require("hardhat");
const { USER_INITIAL_TOKEN_BALANCE } = require("../utils/config");
const getContracts = require("./deployedContracts");

const USER_LIQUIDITY_WETH_ROPSTEN = ethers.utils.parseEther("0.05");

async function main() {
  const [, user] = await ethers.getSigners();

  const { wallet, sushi } = await getContracts();

  const tokenToDeposit = USER_INITIAL_TOKEN_BALANCE.mul(2);
  // approve tokens to wallet
  await sushi.connect(user).approve(wallet.address, tokenToDeposit);

  // make deposit with ETH
  const tx = await wallet
    .connect(user)
    .deposit(
      [sushi.address],
      [tokenToDeposit],
      tokenToDeposit.mul(95).div(100),
      USER_LIQUIDITY_WETH_ROPSTEN.mul(95).div(100),
      0,
      { value: USER_LIQUIDITY_WETH_ROPSTEN, gasLimit: 1e6 }
    );

  console.log("sending TX: ", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed at block: ", rc.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
