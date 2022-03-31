import pairJson from "@sushiswap/core/artifacts/contracts/uniswapv2/UniswapV2Pair.sol/UniswapV2Pair.json";
import factoryJson from "@sushiswap/core/artifacts/contracts/uniswapv2/UniswapV2Factory.sol/UniswapV2Factory.json";
import routerJson from "@sushiswap/core/artifacts/contracts/uniswapv2/UniswapV2Router02.sol/UniswapV2Router02.json";

import masterChefJson from "@sushiswap/core/artifacts/contracts/MasterChef.sol/MasterChef.json";
import sushiTokenJson from "@sushiswap/core/artifacts/contracts/SushiToken.sol/SushiToken.json";
import wethJson from "@sushiswap/core/artifacts/contracts/mocks/WETH9Mock.sol/WETH9Mock.json";

import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { SushiWallet } from "../typechain";

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
    this.MasterChef = new ethers.ContractFactory(
      masterChefJson.abi,
      masterChefJson.bytecode,
      deployer
    );

    // Wallet
    this.SushiWallet = await ethers.getContractFactory(
      "SushiWallet",
      walletUser
    );
  });

  beforeEach(async function () {
    // Deploy tokens
    this.sushiToken = await this.SushiToken.deploy();
    this.weth = await this.Weth9.deploy();

    // Deploy Uniswap Factory and Router
    this.factory = await this.SushiFactory.deploy(ethers.constants.AddressZero);
    this.router = await this.SushiRouter.deploy(
      this.factory.address,
      this.weth.address
    );

    // Create Uniswap pair against WETH and add liquidity
    await this.sushiToken.approve(
      this.router.address,
      UNISWAP_INITIAL_TOKEN_RESERVE
    );
    await this.router.addLiquidityETH(
      this.sushiToken.address,
      UNISWAP_INITIAL_TOKEN_RESERVE, // amountTokenDesired
      0, // amountTokenMin
      0, // amountETHMin
      deployer.address, // to
      (await ethers.provider.getBlock("latest")).timestamp * 2, // deadline
      { value: UNISWAP_INITIAL_WETH_RESERVE }
    );

    this.pair = await this.SushiPair.attach(
      await this.factory.getPair(this.sushiToken.address, this.weth.address)
    );
    expect(await this.pair.balanceOf(deployer.address)).to.be.gt("0");

    // Setup MasterChef
    this.chef = await this.MasterChef.deploy(
      this.sushiToken.address,
      deployer.address,
      ethers.utils.parseEther("10"),
      0,
      1000
    );

    await this.sushi.transferOwnership(this.chef.address);

    await this.chef.add(100, this.pair.address, true);

    // Send tokens to walletUser
    await this.sushiToken.transfer(
      walletUser.address,
      USER_INITIAL_TOKEN_BALANCE
    );
    expect(await this.sushiToken.balanceOf(walletUser.address)).to.be.eq(
      USER_INITIAL_TOKEN_BALANCE
    );

    this.wallet = await this.SushiWallet.deploy(
      this.factory.address,
      this.router.address,
      this.weth.address
    );
  });

  it("Must have sufficient balance in contract", async function () {
    const amountDesired = ethers.utils.parseEther("1");

    expect(await this.sushiToken.balanceOf(this.wallet.address)).to.be.lt(
      amountDesired
    );

    await expect(
      this.wallet.depositWithEth(this.sushiToken.address, amountDesired)
    ).to.be.reverted;
  });
});
