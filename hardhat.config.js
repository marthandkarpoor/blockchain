require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: "0.8.20",
  networks: {
    // Ganache GUI default: http://127.0.0.1:7545 (Ganache CLI uses 8545)
    ganache: { url: "http://127.0.0.1:7545", chainId: 1337 },
    // Hardhat built-in node (npx hardhat node): http://127.0.0.1:8545
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
  },
};
