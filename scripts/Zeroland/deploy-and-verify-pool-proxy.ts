import { ethers } from "hardhat";
import { PoolProxy, InitializableAdminUpgradeabilityProxy } from "../typechain";
import { save } from "./utils";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // These addresses should be configured based on your deployment environment
  const zerolendPoolAddress = "0x0524d5F83C99052607a8838f6868438BB4089136";
  const settingsAddress = "0x0928d67A277891832c743F8179bf2035D0025392";
  const blueprintAddress = "0x38057d2befEfF36691fBDdD5E09b5aa7f431dFe6";

  try {
    // Step 1: Deploy the implementation contract
    console.log("\nStep 1: Deploying PoolProxy implementation...");
    const PoolProxyFactory = await ethers.getContractFactory("PoolProxy");
    const poolProxyImpl = await PoolProxyFactory.deploy(zerolendPoolAddress, settingsAddress);
    await poolProxyImpl.waitForDeployment();
    const poolProxyImplAddress = await poolProxyImpl.getAddress();
    console.log("✅ PoolProxy implementation deployed at:", poolProxyImplAddress);

    // Step 2: Initialize the implementation
    console.log("\nStep 2: Initializing implementation...");
    const initTx = await poolProxyImpl.initialize(blueprintAddress);
    const initReceipt = await initTx.wait();
    if (initReceipt) {
      console.log("✅ Implementation initialization transaction:", initReceipt.hash);
    } else {
      console.log("⚠️ Implementation initialization transaction was sent but receipt not available");
    }

    // Verify implementation initialization
    const beacon = await poolProxyImpl.beacon();
    console.log("Beacon address:", beacon);
    if (beacon !== ethers.ZeroAddress) {
      console.log("✅ Implementation beacon initialized");
    } else {
      console.log("❌ Implementation beacon not initialized");
    }

    // Step 3: Deploy the proxy contract
    console.log("\nStep 3: Deploying proxy contract...");
    const ProxyFactory = await ethers.getContractFactory("InitializableAdminUpgradeabilityProxy");
    const proxy = await ProxyFactory.deploy();
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log("✅ Proxy deployed at:", proxyAddress);

    // Step 4: Initialize the proxy
    console.log("\nStep 4: Initializing proxy...");
    const initData = poolProxyImpl.interface.encodeFunctionData("initialize", [blueprintAddress]);
    console.log("Initialization data:", initData);

    const proxyInitTx = await proxy["initialize(address,address,bytes)"](
      poolProxyImplAddress,
      deployer.address,
      initData
    );
    const proxyInitReceipt = await proxyInitTx.wait();
    if (proxyInitReceipt) {
      console.log("✅ Proxy initialization transaction:", proxyInitReceipt.hash);
    } else {
      console.log("⚠️ Proxy initialization transaction was sent but receipt not available");
    }

    // Step 5: Save deployment artifacts
    console.log("\nStep 5: Saving deployment artifacts...");
    save(
      "tac_turin",
      "PoolProxyImpl",
      "PoolProxy",
      poolProxyImplAddress
    );

    save(
      "tac_turin",
      "PoolProxy-Proxy",
      "InitializableAdminUpgradeabilityProxy",
      proxyAddress
    );
    console.log("✅ Deployment artifacts saved");

    // Step 6: Verify the deployment
    console.log("\nStep 6: Verifying deployment...");
    
    // Get the proxy contract instance
    const proxyContract = await ethers.getContractAt("InitializableAdminUpgradeabilityProxy", proxyAddress);
    
    // Verify implementation address
    const currentImpl = await proxyContract.implementation.staticCall();
    console.log("Current implementation address:", currentImpl);
    if (currentImpl.toLowerCase() === poolProxyImplAddress.toLowerCase()) {
      console.log("✅ Implementation address matches");
    } else {
      console.log("❌ Implementation address mismatch");
    }

    // Verify admin address
    const admin = await proxyContract.admin.staticCall();
    console.log("Admin address:", admin);
    if (admin.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("✅ Admin address matches deployer");
    } else {
      console.log("❌ Admin address mismatch");
    }

    // Get the PoolProxy contract instance
    const poolProxy = await ethers.getContractAt("PoolProxy", proxyAddress);
    
    // Verify app address
    const appAddress = await poolProxy.getAppAddress.staticCall();
    console.log("App address:", appAddress);
    if (appAddress.toLowerCase() === zerolendPoolAddress.toLowerCase()) {
      console.log("✅ App address matches");
    } else {
      console.log("❌ App address mismatch");
    }

    // Verify owner address
    const owner = await poolProxy.owner.staticCall();
    console.log("Owner address:", owner);
    if (owner.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("✅ Owner address matches deployer");
    } else {
      console.log("❌ Owner address mismatch");
    }

    // Verify beacon address
    const proxyBeacon = await poolProxy.beacon.staticCall();
    console.log("Beacon address:", proxyBeacon);
    if (proxyBeacon !== ethers.ZeroAddress) {
      console.log("✅ Beacon is initialized");
    } else {
      console.log("❌ Beacon is not initialized");
    }

    // Verify cross chain layer address
    const crossChainLayer = await poolProxy.getCrossChainLayerAddress.staticCall();
    console.log("Cross Chain Layer address:", crossChainLayer);
    if (crossChainLayer !== ethers.ZeroAddress) {
      console.log("✅ Cross Chain Layer is initialized");
    } else {
      console.log("❌ Cross Chain Layer is not initialized");
    }

    console.log("\nDeployment Summary:");
    console.log("PoolProxy Implementation:", poolProxyImplAddress);
    console.log("PoolProxy Proxy:", proxyAddress);
    console.log("Initialization Status:", proxyBeacon !== ethers.ZeroAddress ? "✅ Successfully initialized" : "❌ Not initialized");

  } catch (error) {
    console.error("Error during deployment:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 