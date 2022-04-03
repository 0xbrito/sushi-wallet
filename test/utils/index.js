const { USER_LIQUIDITY_SUSHI, USER_LIQUIDITY_WETH } = require("./config");

module.exports = {
  // @ts-ignore:
  deposit: async function deposit(overrides) {
    const defaultParams = {
      // @ts-ignore:
      tokenA: this.sushi.address,
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
  },

  deploy: async (factory, params = []) => await factory.deploy(...params),
  balanceOf: async (token, owner) => await token.balanceOf(owner),
};
