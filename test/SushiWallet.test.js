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
  const USER_LIQUIDITY_SUSHI = ethers.utils.parseEther("100");
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
  // @ts-ignore:
  async function deposit(overrides) {
    const defaultParams = {
      // @ts-ignore:
      tokenA: this.sushiToken.address,
      // @ts-ignore:
      tokenB: this.weth.address,
      amountADesired: USER_LIQUIDITY_SUSHI,
      amountBDesired: USER_LIQUIDITY_WETH,
      amountAMin: USER_LIQUIDITY_SUSHI.mul(95).div(100),
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

    it("should Add liquidity and stake LPs in a single transaction", async function () {
      await this.weth
        .connect(walletUser)
        .approve(this.wallet.address, USER_LIQUIDITY_WETH);
      await this.sushiToken
        .connect(walletUser)
        .approve(this.wallet.address, USER_LIQUIDITY_SUSHI);

      const pendingSushiBefore = await this.wallet.pending(0);
      const sushiBalBefore = await this.sushiToken.balanceOf(
        walletUser.address
      );
      const wethBalBefore = await this.weth.balanceOf(walletUser.address);

      const tx = await deposit.call(this, {});
      await walletUser.sendTransaction(tx);

      // Check that user has less tokens
      expect(await this.sushiToken.balanceOf(walletUser.address)).to.be.eq(
        sushiBalBefore.sub(USER_LIQUIDITY_SUSHI)
      );
      expect(await this.weth.balanceOf(walletUser.address)).to.be.eq(
        wethBalBefore.sub(USER_LIQUIDITY_WETH)
      );

      // Ensure LPs are staked in the Chef contract
      const staked = await this.wallet.staked(0);
      expect(staked).to.be.gt("0");
      expect(await this.pair.balanceOf(this.chef.address)).to.be.gte(staked);
      expect(await this.pair.balanceOf(this.wallet.address)).to.be.eq("0");

      // Get pending sushi
      ethers.provider.send("evm_mine", []);
      expect(await this.wallet.pending(0)).to.be.gt(pendingSushiBefore);
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
        .approve(this.wallet.address, USER_LIQUIDITY_SUSHI);

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
    before(async function () {
      // Deploy wallet
      this.wallet = await this.SushiWallet.deploy(
        this.router.address,
        this.chef.address,
        this.weth.address
      );
      await this.wallet.deployed();

      // wrap ETH
      await this.weth
        .connect(walletUser)
        .deposit({ value: USER_LIQUIDITY_WETH });

      //approve tokens
      await this.weth
        .connect(walletUser)
        .approve(this.wallet.address, USER_LIQUIDITY_WETH);
      await this.sushiToken
        .connect(walletUser)
        .approve(this.wallet.address, USER_LIQUIDITY_SUSHI);

      await walletUser.sendTransaction(await deposit.call(this));
      await ethers.provider.send("evm_mine", []);
    });
    it("should withdraw and break LPs", async function () {
      await ethers.provider.send("evm_mine", []);
      const stakedAmountBefore = await this.wallet.staked(0); //get staked LP tokens
      const amountTowithDraw = stakedAmountBefore.div(2); //Withdraw half staked LP tokens

      const pendingBefore = await this.wallet.pending(0);

      const userSushiBalBefore = await this.sushiToken.balanceOf(
        walletUser.address
      );
      const userWethBalBefore = await this.weth.balanceOf(walletUser.address);

      const chefLpBalBefore = await this.pair.balanceOf(this.chef.address);

      await this.wallet.withdraw(0, amountTowithDraw);

      expect(await this.wallet.staked(0)).to.be.eq(
        stakedAmountBefore.sub(amountTowithDraw)
      );
      expect(await this.pair.balanceOf(this.chef.address)).to.be.eq(
        chefLpBalBefore.sub(amountTowithDraw)
      );

      // wallet must break LPs
      expect(await this.pair.balanceOf(this.wallet.address)).to.be.eq("0");

      // ensure user gets tokens
      expect(await this.wallet.pending(0)).to.be.lt(pendingBefore);
      expect(await this.sushiToken.balanceOf(walletUser.address)).to.be.gte(
        userSushiBalBefore.add(pendingBefore)
      );
      expect(await this.weth.balanceOf(walletUser.address)).to.be.gt(
        userWethBalBefore
      );
    });
    it("harvest when 0 amount is given and there's pending sushi", async function () {
      await ethers.provider.send("evm_mine", []);
      const pendingBefore = await this.wallet.pending(0);

      const userSushiBalBefore = await this.sushiToken.balanceOf(
        walletUser.address
      );
      await this.wallet.withdraw(0, 0);
      // ensure user get sushi
      expect(await this.wallet.pending(0)).to.be.lt(pendingBefore);
      expect(await this.sushiToken.balanceOf(walletUser.address)).to.be.gt(
        userSushiBalBefore
      );
    });
    it("should emergency withdraw");
    it("reverts if given pid is invalid", async function () {
      await expect(this.wallet.withdraw(10, 0)).to.be.revertedWith(
        "SushiWallet: Invalid pid"
      );
    });
    it("reverts if amount to withdraw is invalid", async function name() {
      await expect(
        this.wallet.withdraw(0, (await this.wallet.staked(0)).add(1))
      ).to.be.revertedWith("withdraw: not good");
    });
  });
});
