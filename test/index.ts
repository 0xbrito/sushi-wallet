import pairJson from "@sushiswap/core/artifacts/contracts/uniswapv2/UniswapV2Pair.sol/UniswapV2Pair.json";
import factoryJson from "@sushiswap/core/artifacts/contracts/uniswapv2/UniswapV2Factory.sol/UniswapV2Factory.json";
import routerJson from "@sushiswap/core/artifacts/contracts/uniswapv2/UniswapV2Router02.sol/UniswapV2Router02.json";

// import masterChefJson from "@sushiswap/core/abi/MasterChef.json";
// import sushiToken from "@sushiswap/core/abi/SushiToken.json";

import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { MockToken, SushiWallet, WETH9 } from "../typechain";
import { Contract } from "ethers";

describe("SushiWallet", function () {
  let deployer: SignerWithAddress,
    walletUser: SignerWithAddress,
    SushiWallet: SushiWallet,
    mockToken: MockToken,
    weth: WETH9;

  let pair: Contract, sushiSwapFactory, sushiswapRouter;

  const UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther("100000");
  const UNISWAP_INITIAL_WETH_RESERVE = ethers.utils.parseEther("100");
  const USER_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther("1000");

  before(async function () {
    [deployer, walletUser] = await ethers.getSigners();
    const UniswapFactoryFactory = new ethers.ContractFactory(
      factoryJson.abi,
      factoryJson.bytecode,
      deployer
    );

    const UniswapRouterFactory = new ethers.ContractFactory(
      routerJson.abi,
      routerJson.bytecode,
      deployer
    );

    const UniswapPairFactory = new ethers.ContractFactory(
      pairJson.abi,
      pairJson.bytecode,
      deployer
    );

    // Deploy tokens
    mockToken = await (
      await ethers.getContractFactory("MockToken", deployer)
    ).deploy();
    weth = await (await ethers.getContractFactory("WETH9", deployer)).deploy();

    // Deploy Uniswap Factory and Router
    sushiSwapFactory = await UniswapFactoryFactory.deploy(
      ethers.constants.AddressZero
    );
    sushiswapRouter = await UniswapRouterFactory.deploy(
      sushiSwapFactory.address,
      weth.address
    );

    // Create Uniswap pair against WETH and add liquidity
    await mockToken.approve(
      sushiswapRouter.address,
      UNISWAP_INITIAL_TOKEN_RESERVE
    );
    await sushiswapRouter.addLiquidityETH(
      mockToken.address,
      UNISWAP_INITIAL_TOKEN_RESERVE, // amountTokenDesired
      0, // amountTokenMin
      0, // amountETHMin
      deployer.address, // to
      (await ethers.provider.getBlock("latest")).timestamp * 2, // deadline
      { value: UNISWAP_INITIAL_WETH_RESERVE }
    );

    pair = await UniswapPairFactory.attach(
      await sushiSwapFactory.getPair(mockToken.address, weth.address)
    );
    expect(await pair.balanceOf(deployer.address)).to.be.gt("0");

    // Send tokens to walletUser
    mockToken.transfer(walletUser.address, USER_INITIAL_TOKEN_BALANCE);
    expect(await mockToken.balanceOf(walletUser.address)).to.be.eq(
      USER_INITIAL_TOKEN_BALANCE
    );

    // Deploy wallet
    const SushiWalletFactory = await ethers.getContractFactory(
      "SushiWallet",
      walletUser
    );

    SushiWallet = await SushiWalletFactory.deploy(
      sushiSwapFactory.address,
      sushiswapRouter.address,
      weth.address
    );
  });

  it("Must have sufficient balance in contract", async function () {
    const amountDesired = ethers.utils.parseEther("1");

    expect(await mockToken.balanceOf(SushiWallet.address)).to.be.lt(
      amountDesired
    );

    await expect(SushiWallet.depositWithEth(mockToken.address, amountDesired))
      .to.be.reverted;
  });
});
