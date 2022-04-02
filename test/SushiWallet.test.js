const pairJson = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const factoryJson = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerJson = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");

const masterChefJson = require("@sushiswap/core/artifacts/contracts/MasterChef.sol/MasterChef.json");
const sushiTokenJson = require("@sushiswap/core/artifacts/contracts/SushiToken.sol/SushiToken.json");
const wethJson = require("@uniswap/v2-periphery/build/WETH9.json");

const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("[SushiWallet]", function () {
  let deployer, walletUser;

  const UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther("10000");
  const UNISWAP_INITIAL_WETH_RESERVE = ethers.utils.parseEther("100");

  const USER_LIQUIDITY_WETH = ethers.utils.parseEther("1");
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
      const router = this.router.address;
      const chef = this.chef.address;
      const weth = this.weth.address;

      const wallet = await this.SushiWallet.deploy(router, chef, weth);
      await wallet.deployed();

      expect(await wallet.router()).to.be.eq(router);
      expect(await wallet.chef()).to.be.eq(chef);
      expect(await wallet.weth()).to.be.eq(weth);

      // Check that deployer became owner
      expect(await wallet.owner()).to.be.eq(walletUser.address);
    });
    it("reverts when zero address is given", async function () {
      await expect(
        this.SushiWallet.deploy(
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
      this.wallet = await this.SushiWallet.deploy(
        this.router.address,
        this.chef.address,
        this.weth.address
      );
      await this.wallet.deployed();

      await this.weth
        .connect(walletUser)
        .deposit({ value: USER_LIQUIDITY_WETH });
    });

    // @ts-ignore:
    async function deposit(overrides) {
      const defaultParams = {
        // @ts-ignore:
        tokenA: this.sushiToken.address,
        // @ts-ignore:
        tokenB: this.weth.address,
        amountADesired: USER_INITIAL_TOKEN_BALANCE.div(10),
        amountBDesired: USER_LIQUIDITY_WETH,
        amountAMin: USER_INITIAL_TOKEN_BALANCE.div(10).mul(95).div(100),
        amountBMin: USER_LIQUIDITY_WETH.mul(95).div(100),
        // @ts-ignore
        lp: this.pair.address,
        pid: 0,
        ...overrides,
      };

      // @ts-ignore:
      const tx = await this.wallet.populateTransaction.deposit(
        defaultParams.tokenA,
        defaultParams.tokenB,
        defaultParams.amountADesired,
        defaultParams.amountBDesired,
        defaultParams.amountAMin,
        defaultParams.amountBMin,
        defaultParams.lp,
        defaultParams.pid
      );
      return tx;
    }

    it("should Add liquidity and stake LPs in a single transaction", async function () {
      const sushiToDeposit = USER_INITIAL_TOKEN_BALANCE.div(10);
      await this.weth
        .connect(walletUser)
        .approve(this.wallet.address, USER_LIQUIDITY_WETH);
      await this.sushiToken
        .connect(walletUser)
        .approve(this.wallet.address, sushiToDeposit);

      const pendingSushiBefore = await this.chef.pendingSushi(
        0,
        this.wallet.address
      );
      const sushiBalBefore = await this.sushiToken.balanceOf(
        walletUser.address
      );
      const wethBalBefore = await this.weth.balanceOf(walletUser.address);

      const tx = await deposit.call(this, {});
      await walletUser.sendTransaction(tx);

      expect(await this.sushiToken.balanceOf(walletUser.address)).to.be.eq(
        sushiBalBefore.sub(sushiToDeposit)
      );
      expect(await this.weth.balanceOf(walletUser.address)).to.be.eq(
        wethBalBefore.sub(USER_LIQUIDITY_WETH)
      );

      ethers.provider.send("evm_mine", []);
      expect(await this.chef.pendingSushi(0, this.wallet.address)).to.be.gt(
        pendingSushiBefore
      );
    });
    it("retrieve staked amount", async function () {
      expect(await this.wallet.staked(0)).to.not.be.undefined;
    });
    it("retrieve pending sushi", async function () {
      expect(await this.wallet.pending(0)).to.not.be.undefined;
    });
    it("reverts if user has no enough balance", async function () {
      await expect(
        walletUser.sendTransaction(
          await deposit.call(this, {
            amountADesired: USER_INITIAL_TOKEN_BALANCE,
          })
        )
      ).to.be.revertedWith("Insufficient token balance");
    });
    it("reverts if user hasn't approved enough tokens", async function () {
      await expect(
        walletUser.sendTransaction(await deposit.call(this))
      ).to.be.revertedWith("SushiWallet: Insufficient allowance");
    });

    it("reverts if given a non-existent pool", async function () {
      await this.sushiToken
        .connect(walletUser)
        .approve(this.wallet.address, USER_INITIAL_TOKEN_BALANCE);

      await this.weth
        .connect(walletUser)
        .approve(this.wallet.address, USER_LIQUIDITY_WETH);

      await expect(
        walletUser.sendTransaction(
          await deposit.call(this, {
            pid: 10,
          })
        )
      ).to.be.revertedWith("SushiWallet: Invalid pid");
    });
  });

  describe("[WithDraw]", async function () {
    it("should withdraw and break LPs");
    it("should withdraw and give ");
    it("should emergency withdraw");
  });
});
