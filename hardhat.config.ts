import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";

dotenv.config();

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  networks: {
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

export default config;
