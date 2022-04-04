# Sushi Wallet

Staking smart contract that acts as a layer on top of Router and MasterChef to join Sushiswap's liquidity mining program with a straightforward approach.

## Description

The main purpose of this contract is to handle most of the transactions required to farm LP tokens in a single transaction, giving the user the ability to skip most of them and thus saving time and gas. Also, it can withdraw LP tokens and remove liquidity  at the same time!

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

#### Run tests

```bash
  yarn test
```
