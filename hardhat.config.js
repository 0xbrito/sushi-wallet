require("@nomiclabs/hardhat-waffle");

// Load variables from .env
require("dotenv").config();

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const { DEPLOYER_PRIVATE_KEY, USER_PRIVATE_KEY, ROPSTEN_RPC } = process.env;

module.exports = {
  networks: {
    ropsten: {
      url: ROPSTEN_RPC,
      accounts: [DEPLOYER_PRIVATE_KEY, USER_PRIVATE_KEY],
    },
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
  solidity: {
    compilers: [
      { version: "0.8.4" },
      { version: "0.7.6" },
      { version: "0.6.12" },
      { version: "0.6.6" },
      { version: "0.5.0" },
    ],
  },
};
