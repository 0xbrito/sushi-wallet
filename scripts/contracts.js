require("dotenv").config();
const { ethers } = require("hardhat");
const sushiAbi = require("@sushiswap/core/abi/SushiToken.json");
const chefAbi = require("@sushiswap/core/abi/MasterChef.json");
const routerAbi =
  require("@uniswap/v2-periphery/build/UniswapV2Router02.json").abi;
const pairAbi = require("@uniswap/v2-core/build/UniswapV2Pair.json").abi;

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

  return {
    sushi,
    router,
    pair,
    chef,
  };
}

module.exports = getContracts;
