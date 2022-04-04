require("dotenv").config();
const { ethers } = require("hardhat");
const sushiAbi = require("@sushiswap/core/abi/SushiToken.json");
const chefAbi = require("@sushiswap/core/abi/MasterChef.json");
const routerAbi =
  require("@uniswap/v2-periphery/build/UniswapV2Router02.json").abi;
const pairAbi = require("@uniswap/v2-core/build/UniswapV2Pair.json").abi;
const walletAbi =
  require("../artifacts/contracts/SushiWallet.sol/SushiWallet.json").abi;

async function getContracts() {
  const [deployer, user] = await ethers.getSigners();

  const sushi = new ethers.Contract(
    process.env.SUSHI_ADDRESS_ROPSTEN,
    sushiAbi
  );

  const router = new ethers.Contract(
    process.env.ROUTER_ADDRESS_ROPSTEN,
    routerAbi
  );

  const pair = new ethers.Contract(process.env.PAIR_ADDRESS_ROPSTEN, pairAbi);

  const chef = new ethers.Contract(
    process.env.MASTER_CHEF_ADDRESS_ROPSTEN,
    chefAbi
  );

  const wallet = new ethers.Contract(
    process.env.WALLET_ADDRESS_ROPSTEN,
    walletAbi
  );

  return {
    sushi,
    router,
    pair,
    chef,
    wallet,
  };
}

module.exports = getContracts;
