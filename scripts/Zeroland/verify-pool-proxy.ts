import { ethers } from "hardhat";
import { PoolProxy, InitializableAdminUpgradeabilityProxy } from "../typechain";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Verifying with account:", deployer.address);

  // Get the proxy address from deployments
  const proxyAddress = "0xbf9421e8B08AeD16c05d99b8079571729d72e64b";
  console.log("Proxy address:", proxyAddress);

  // Get the implementation address from deployments
  const implAddress = "0xB7931D1CAac3A7Bde89d129288e7e98E3e4636E1";
  console.log("Implementation address:", implAddress);

  // Expected addresses
  const expectedZerolendPoolAddress = "0x0524d5F83C99052607a8838f6868438BB4089136";
  const expectedSettingsAddress = "0x0928d67A277891832c743F8179bf2035D0025392";
  const expectedBlueprintAddress = "0x38057d2befEfF36691fBDdD5E09b5aa7f431dFe6";

  try {
    // Step 1: Verify proxy contract
    console.log("\nStep 1: Verifying proxy contract...");
    const proxy = await ethers.getContractAt("InitializableAdminUpgradeabilityProxy", proxyAddress);
    
    // Check implementation address
    try {
      const currentImpl = await proxy.implementation.staticCall();
      console.log("Current implementation address:", currentImpl);
      if (currentImpl.toLowerCase() === implAddress.toLowerCase()) {
        console.log("✅ Implementation address matches");
      } else {
        console.log("❌ Implementation address mismatch");
        console.log("Expected:", implAddress);
        console.log("Got:", currentImpl);
      }
    } catch (error: any) {
      console.log("❌ Failed to get implementation address:", error.message);
    }

    // Check admin address
    try {
      const admin = await proxy.admin.staticCall();
      console.log("Admin address:", admin);
      if (admin.toLowerCase() === deployer.address.toLowerCase()) {
        console.log("✅ Admin address matches deployer");
      } else {
        console.log("❌ Admin address mismatch");
        console.log("Expected:", deployer.address);
        console.log("Got:", admin);
      }
    } catch (error: any) {
      console.log("❌ Failed to get admin address:", error.message);
    }

    // Step 2: Verify PoolProxy contract
    console.log("\nStep 2: Verifying PoolProxy contract...");
    const poolProxy = await ethers.getContractAt("PoolProxy", implAddress);
    
    // Check app address
    try {
      const appAddress = await poolProxy.getAppAddress.staticCall();
      console.log("App address:", appAddress);
      if (appAddress.toLowerCase() === expectedZerolendPoolAddress.toLowerCase()) {
        console.log("✅ App address matches");
        // fetch the reserve addresses from the pool contract
        const poolContract = await ethers.getContractAt("@zerolendxyz/core-v3/contracts/interfaces/IPool.sol:IPool", appAddress);
        const reserveAddresses = await poolContract.getReservesList();
        console.log("Reserve addresses:", reserveAddresses);
      } else {
        console.log("❌ App address mismatch");
        console.log("Expected:", expectedZerolendPoolAddress);
        console.log("Got:", appAddress);
      }
    } catch (error: any) {
      console.log("❌ Failed to get app address:", error.message);
    }

    // Check owner address
    try {
      const owner = await poolProxy.owner.staticCall();
      console.log("Owner address:", owner);
      if (owner.toLowerCase() === deployer.address.toLowerCase()) {
        console.log("✅ Owner address matches deployer");
      } else {
        console.log("❌ Owner address mismatch");
        console.log("Expected:", deployer.address);
        console.log("Got:", owner);
      }
    } catch (error: any) {
      console.log("❌ Failed to get owner address:", error.message);
    }

    // Check cross chain layer address
    try {
      const crossChainLayer = await poolProxy..staticCall();
      console.log("Cross Chain Layer address:", crossChainLayer);
    } catch (error: any) {
      console.log("❌ Failed to get cross chain layer address:", error.message);
    }

    // Check beacon address
    try {
      const beacon = await poolProxy.beacon.staticCall();
      console.log("Beacon address:", beacon);
      if (beacon !== ethers.ZeroAddress) {
        console.log("✅ Beacon is initialized");
      } else {
        console.log("❌ Beacon is not initialized");
      }
    } catch (error: any) {
      console.log("❌ Failed to get beacon address:", error.message);
    }

    // Step 3: Verify implementation contract
    console.log("\nStep 3: Verifying implementation contract...");
    const implementation = await ethers.getContractAt("PoolProxy", implAddress);
    
    // Check constructor parameters
    try {
      const implAppAddress = await implementation.getAppAddress.staticCall();
      console.log("Implementation app address:", implAppAddress);
      if (implAppAddress.toLowerCase() === expectedZerolendPoolAddress.toLowerCase()) {
        console.log("✅ Implementation app address matches");
      } else {
        console.log("❌ Implementation app address mismatch");
        console.log("Expected:", expectedZerolendPoolAddress);
        console.log("Got:", implAppAddress);
      }
    } catch (error: any) {
      console.log("❌ Failed to get implementation app address:", error.message);
    }

    // Check beacon
    try {
      const implBeacon = await implementation.beacon.staticCall();
      console.log("Implementation beacon address:", implBeacon);
      if (implBeacon !== ethers.ZeroAddress) {
        console.log("✅ Implementation beacon is initialized");
      } else {
        console.log("❌ Implementation beacon is not initialized");
      }
    } catch (error: any) {
      console.log("❌ Failed to get implementation beacon address:", error.message);
    }

    console.log("\nVerification Summary:");
    console.log("Proxy Address:", proxyAddress);
    console.log("Implementation Address:", implAddress);
    console.log("Note: If you see multiple ❌ errors, this suggests the proxy contract is not properly initialized.");
    console.log("Please check the deployment and initialization steps.");

  } catch (error: any) {
    console.error("Error during verification:", error);
    console.log("\nThis error suggests that the contracts are not properly deployed or initialized.");
    console.log("Please check the deployment and initialization steps.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 