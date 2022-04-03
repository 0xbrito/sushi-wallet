const { ethers } = require("hardhat");
const {
  USER_INITIAL_TOKEN_BALANCE,
  UNISWAP_INITIAL_TOKEN_RESERVE,
} = require("../utils/config");
const getContracts = require("./contracts");

async function main() {
  const [deployer, user] = await ethers.getSigners();
  const { sushi } = await getContracts();

  await sushi.connect(deployer).mint(user.address, USER_INITIAL_TOKEN_BALANCE);
  await sushi.connect(deployer).mint(deployer.address, UNISWAP_INITIAL_TOKEN_RESERVE);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
