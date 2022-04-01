import pairJson from "@uniswap/v2-core/build/UniswapV2Pair.json";
import factoryJson from "@uniswap/v2-core/build/UniswapV2Factory.json";
import routerJson from "@uniswap/v2-periphery/build/UniswapV2Router02.json";

import masterChefJson from "@sushiswap/core/artifacts/contracts/MasterChef.sol/MasterChef.json";
import sushiTokenJson from "@sushiswap/core/artifacts/contracts/SushiToken.sol/SushiToken.json";
import wethJson from "@uniswap/v2-periphery/build/WETH9.json";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("SushiWallet", function () {
  let deployer: SignerWithAddress, walletUser: SignerWithAddress;

  const UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther("100000");
  const UNISWAP_INITIAL_WETH_RESERVE = ethers.utils.parseEther("100");
  const USER_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther("1000");

  before(async function () {
    [deployer, walletUser] = await ethers.getSigners();

    this.SushiFactory = new ethers.ContractFactory(
      factoryJson.abi,
      factoryJson.bytecode,
      deployer
    );
    this.SushiRouter = new ethers.ContractFactory(
      routerJson.abi,
      routerJson.bytecode,
      deployer
    );
    this.SushiPair = new ethers.ContractFactory(
      pairJson.abi,
      pairJson.bytecode,
      deployer
    );

    // tokens
    this.SushiToken = new ethers.ContractFactory(
      sushiTokenJson.abi,
      sushiTokenJson.bytecode,
      deployer
    );
    this.Weth9 = new ethers.ContractFactory(
      wethJson.abi,
      wethJson.bytecode,
      deployer
    );
  });

  beforeEach(async function () {
    this.factory = await this.SushiFactory.deploy(deployer.address);

    this.weth = await this.Weth9.deploy();

    this.sushiToken = await this.SushiToken.deploy();
    // Mint tokens
    await this.sushiToken.mint(deployer.address, UNISWAP_INITIAL_TOKEN_RESERVE);
    await this.sushiToken.mint(walletUser.address, USER_INITIAL_TOKEN_BALANCE);

    this.router = await this.SushiRouter.deploy(
      this.factory.address,
      this.weth.address
    );

    // Create Uniswap pair against WETH and add liquidity
    await this.sushiToken
      .connect(deployer)
      .approve(this.router.address, UNISWAP_INITIAL_TOKEN_RESERVE);

    await this.router.addLiquidityETH(
      this.sushiToken.address,
      UNISWAP_INITIAL_TOKEN_RESERVE, // amountTokenDesired
      0, // amountTokenMin
      0, // amountETHMin
      deployer.address, // to
      (await ethers.provider.getBlock("latest")).timestamp * 2, // deadline
      { value: UNISWAP_INITIAL_WETH_RESERVE }
    );

    const pair = await this.SushiPair.attach(
      await this.factory.getPair(this.sushiToken.address, this.weth.address)
    );

    expect(await pair.balanceOf(deployer.address)).to.be.gt("0");
  });

  it("Must have sufficient balance in contract", async function () {});
});
