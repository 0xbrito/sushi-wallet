# Sushi Wallet

Staking smart contract that acts as a layer on top of Router and MasterChef to join Sushiswap's liquidity mining program with a straightforward approach.

## Description

The main purpose of this contract is to handle most of the transactions required to farm LP tokens in a single transaction, giving the user the ability to skip most of them and thus saving time and gas. Also, it can withdraw LP tokens and remove liquidity at the same time!

The interactions with MasterChef and Router are on behalf of the user, so no tokens or ETH will stay in the contract since it's only a intermediary.

## Run Locally

#### Clone the project

```bash
  git clone https://github.com/britodiego/sushi-wallet.git
```

#### Go to the project directory

```bash
  cd sushi-wallet
```

#### Install dependencies

Using `yarn`

```bash
  yarn
```

or Using `npm`

```bash
  npm install
```

#### Compile contracts

```bash
  yarn compile
```

## Running Tests

To run tests, run the following command

```bash
  yarn test
```

## Demo

SushiWallet and the contracts used to test it were all deployed to ropsten under the following addresses:

| Contract          | Address                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| SushiWallet       | [0xC285Be77ce5A8D3fAC3d7dFfFD15969Cdb3F5781](https://ropsten.etherscan.io/address/0xC285Be77ce5A8D3fAC3d7dFfFD15969Cdb3F5781) |
| MasterChef        | [0x1F4f639b8621bA484779e0349133ae38D9B3FE75](https://ropsten.etherscan.io/address/0x1F4f639b8621bA484779e0349133ae38D9B3FE75) |
| SushiToken        | [0xFfCe7F971356dA939A8DD6D00a733fE210a3Eae4](https://ropsten.etherscan.io/token/0xFfCe7F971356dA939A8DD6D00a733fE210a3Eae4)   |
| UniswapV2Router02 | [0x435603100F3553B190ea25A6009F10E858B880F5](https://ropsten.etherscan.io/address/0x435603100F3553B190ea25A6009F10E858B880F5) |
| UniswapV2Factory  | [0xF272561Abe4d741AbFcC05295cD14A705DdF3904](https://ropsten.etherscan.io/address/0xF272561Abe4d741AbFcC05295cD14A705DdF3904) |
| UniswapV2Pair     | [0x19c9265bCd56e0de5bC1c96CaC5f29F47d77dC37](https://ropsten.etherscan.io/address/0x19c9265bcd56e0de5bc1c96cac5f29f47d77dc37) |
| WETH9             | [0x099c724fFDD4DF267d28C80794b57537dDc974ff](https://ropsten.etherscan.io/token/0x099c724fFDD4DF267d28C80794b57537dDc974ff)   |

## License

[MIT](https://choosealicense.com/licenses/mit/)
