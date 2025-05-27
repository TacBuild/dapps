import { ethers } from "hardhat";
import { PoolProxy, InitializableAdminUpgradeabilityProxy } from "../typechain";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);

  // Get the proxy address from deployments
  const proxyAddress = "0x5Ae6B2B9b28a649eF3FaBd99DAc25CA4110786AD";
  console.log("Proxy address:", proxyAddress);

  // Get the implementation address from deployments
  const implAddress = "0xa09739A6Fb46b10a11315D935613944ae591285b";
  console.log("Implementation address:", implAddress);

  // Get the proxy contract instance
  const proxy = await ethers.getContractAt("InitializableAdminUpgradeabilityProxy", proxyAddress, deployer);

  try {
    // Get the implementation address through the proxy
    const implementation = await proxy.implementation();
    console.log("Implementation address (through proxy):", implementation);

    // Get the admin address
    const admin = await proxy.admin();
    console.log("Admin address:", admin);

    // Get the PoolProxy contract instance using the implementation
    const poolProxy = await ethers.getContractAt("PoolProxy", proxyAddress, deployer);

    // Get the app address (Zerolend Pool address)
    const appAddress = await poolProxy.getAppAddress();
    console.log("App address (Zerolend Pool):", appAddress);

    // Get the owner address
    const owner = await poolProxy.owner();
    console.log("Owner address:", owner);

    // Get the beacon address
    const beacon = await poolProxy.beacon();
    console.log("Beacon address:", beacon);

    // Get the cross chain layer address
    const crossChainLayer = await poolProxy.getCrossChainLayerAddress();
    console.log("Cross Chain Layer address:", crossChainLayer);

    // Test getting a smart account for a test TVM address
    const testTvmAddress = "test_tvm_address";
    const smartAccount = await poolProxy.smartAccounts(ethers.keccak256(ethers.toUtf8Bytes(testTvmAddress)));
    console.log("Smart account for test TVM address:", smartAccount);
  } catch (error) {
    console.error("Error interacting with proxy contract:", error);
    console.log("This might indicate that the proxy contract is not properly initialized or the implementation is not set correctly.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 