// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers } = require("hardhat");
const { deploy } = require("../utils");
const {
  UNISWAP_INITIAL_TOKEN_RESERVE,
  USER_INITIAL_TOKEN_BALANCE,
} = require("../utils/config");
const getFactories = require("../utils/factories");

const printContractAddress = (contract, name) =>
  console.log(`${name} contract deployed at address: ${contract.address}`);

async function main() {
  console.log("Running deploy.js...");
  const [deployer, user] = await ethers.getSigners();
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contracts to deploy
  //const { SushiFactory, SushiRouter, MasterChef, SushiToken, Weth9 } =
  //await getFactories();

  // SushiWallet Factory
  const SushiWallet = await ethers.getContractFactory("SushiWallet", user);

  // Deploy factory
  const factory = await deploy(SushiFactory, [ethers.constants.AddressZero]);
  printContractAddress(factory, "Factory");
  
  // Deploy tokens
  const weth = await deploy(Weth9);
  printContractAddress(weth, "WETH");
  
  const sushi = await deploy(SushiToken);
  printContractAddress(sushi, "SUSHI");
  
  // Deploy Router
  const router = await deploy(SushiRouter, [factory.address, weth.address]);
  printContractAddress(router, "Router");

  // Deploy MasterChef
  const chef = await deploy(MasterChef, [
    sushi.address,
    deployer.address,
    ethers.utils.parseEther("10"),
    0,
    1000,
  ]);
  printContractAddress(chef, "MasterChef");

  // Deploy wallet
  const wallet = await deploy(SushiWallet, [
    router.address,
    chef.address,
    weth.address,
  ]);
  printContractAddress(wallet, "Sushi Wallet");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
