import pairJson from "@uniswap/v2-core/build/UniswapV2Pair.json";
import factoryJson from "@uniswap/v2-core/build/UniswapV2Factory.json";
import routerJson from "@uniswap/v2-periphery/build/UniswapV2Router02.json";

import masterChefJson from "@sushiswap/core/artifacts/contracts/MasterChef.sol/MasterChef.json";
import sushiTokenJson from "@sushiswap/core/artifacts/contracts/SushiToken.sol/SushiToken.json";
import wethJson from "@uniswap/v2-periphery/build/WETH9.json";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("[SushiWallet]", function () {
  let deployer: SignerWithAddress, walletUser: SignerWithAddress;

  const UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther("10000");
  const UNISWAP_INITIAL_WETH_RESERVE = ethers.utils.parseEther("100");

  const USER_LIQUIDITY_WETH = ethers.utils.parseEther("1");
  const USER_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther("100");

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
    this.MasterChef = new ethers.ContractFactory(
      masterChefJson.abi,
      masterChefJson.bytecode,
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

    // SushiWallet
    this.SushiWallet = await ethers.getContractFactory(
      "SushiWallet",
      walletUser
    );
    this.factory = await this.SushiFactory.deploy(ethers.constants.AddressZero);

    // Deploy tokens
    this.weth = await this.Weth9.deploy();
    this.sushiToken = await this.SushiToken.deploy();

    // Mint SUSHI
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

    this.pair = await this.SushiPair.attach(
      await this.factory.getPair(this.sushiToken.address, this.weth.address)
    );
    expect(await this.pair.balanceOf(deployer.address)).to.be.gt("0");

    // Deploy MasterChef
    this.chef = await this.MasterChef.deploy(
      this.sushiToken.address,
      deployer.address,
      ethers.utils.parseEther("10"),
      0,
      1000
    );
    await this.chef.deployed();
    await this.sushiToken.transferOwnership(this.chef.address);
    expect(await this.sushiToken.owner()).to.be.eq(this.chef.address);

    await this.chef.add("100", this.pair.address, true);
  });

  describe("[Deployment]", async function () {
    it("must set Factory, Router, MasterChef, Weth and Owner addresses", async function () {
      // Deploy wallet
      const factory = this.factory.address;
      const router = this.router.address;
      const chef = this.chef.address;
      const weth = this.weth.address;

      const wallet = await this.SushiWallet.connect(walletUser).deploy(
        factory,
        router,
        chef,
        weth
      );
      await wallet.deployed();

      expect(await wallet.factory()).to.be.eq(factory);
      expect(await wallet.router()).to.be.eq(router);
      expect(await wallet.chef()).to.be.eq(chef);
      expect(await wallet.weth()).to.be.eq(weth);

      // Check that deployer became owner
      expect(await wallet.owner()).to.be.eq(walletUser.address);
    });
    it("reverts when zero address is given", async function () {
      await expect(
        this.SushiWallet.connect(walletUser).deploy(
          this.factory.address,
          this.router.address,
          this.chef.address,
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("SushiWallet: No zero address");
    });
  });

  describe("[Deposit]", async function () {
    beforeEach(async function () {
      // Deploy wallet
      this.wallet = await this.SushiWallet.connect(walletUser).deploy(
        this.factory.address,
        this.router.address,
        this.chef.address,
        this.weth.address
      );
      await this.wallet.deployed();

      await this.weth
        .connect(walletUser)
        .deposit({ value: USER_LIQUIDITY_WETH });
    });

    it("should Add liquidity and stake LPs in a single transaction", async function () {
      await this.weth
        .connect(walletUser)
        .approve(this.wallet.address, USER_LIQUIDITY_WETH);
      await this.sushiToken
        .connect(walletUser)
        .approve(this.wallet.address, USER_INITIAL_TOKEN_BALANCE);

      const pendingSushiBefore = await this.chef.pendingSushi(
        0,
        this.wallet.address
      );
      const sushiBalBefore = await this.sushiToken.balanceOf(
        walletUser.address
      );
      const wethBalBefore = await this.weth.balanceOf(walletUser.address);

      await this.wallet.deposit(
        this.sushiToken.address,
        this.weth.address,
        USER_INITIAL_TOKEN_BALANCE,
        USER_LIQUIDITY_WETH,
        USER_INITIAL_TOKEN_BALANCE.mul(95).div(100),
        USER_LIQUIDITY_WETH.mul(95).div(100),

        0
      );
      expect(await this.sushiToken.balanceOf(walletUser.address)).to.be.eq(
        sushiBalBefore.sub(USER_INITIAL_TOKEN_BALANCE)
      );
      expect(await this.weth.balanceOf(walletUser.address)).to.be.eq(
        wethBalBefore.sub(USER_LIQUIDITY_WETH)
      );

      ethers.provider.send("evm_mine", []);
      expect(await this.chef.pendingSushi(0, this.wallet.address)).to.be.gt(
        pendingSushiBefore
      );
    });
    it("reverts if user has no enough balance", async function () {
      await expect(
        this.wallet.deposit(
          this.sushiToken.address,
          this.weth.address,
          USER_INITIAL_TOKEN_BALANCE,
          USER_LIQUIDITY_WETH,
          USER_INITIAL_TOKEN_BALANCE.mul(95).div(100),
          USER_LIQUIDITY_WETH.mul(95).div(100),
          0
        )
      ).to.be.revertedWith("SushiWallet: Insufficient tokenA in balance");
    });
    it("reverts if user hasn't approved enough tokens", async function () {
      console.log(
        "inside other test",
        await this.sushiToken.balanceOf(walletUser.address)
      );
    });

    it("reverts if given a non-existent pool", async function () {});
  });
  describe("[WithDraw]", async function () {
    it("should withdraw and break LPs");
    it("should withdraw and give ");
    it("should emergency withdraw");
  });
  describe("[Harvest]", async function () {});
});
