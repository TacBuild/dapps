import { ethers } from "hardhat";
import { PoolProxy } from "../typechain";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting app address with account:", deployer.address);

  // Get the proxy address from deployments - update this with your actual proxy address
  const proxyAddress = "0xe539EF1Cab39F554edb6f0858579c80393aE3bc0";
  console.log("Proxy address:", proxyAddress);

  // The new app address to set - update this with your desired address
  const newAppAddress = "0x0524d5F83C99052607a8838f6868438BB4089136"; // Replace with actual address
  console.log("New app address to set:", newAppAddress);

  try {
    // Connect to the PoolProxy contract
    const poolProxy = await ethers.getContractAt("PoolProxy", proxyAddress);
    
    // Check current app address
    const currentAppAddress = await poolProxy.getAppAddress.staticCall();
    console.log("Current app address:", currentAppAddress);
    
    // Check if the caller is the owner
    const owner = await poolProxy.owner.staticCall();
    console.log("Contract owner:", owner);
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error("❌ Error: Caller is not the owner of the contract");
      console.log(`Expected owner: ${owner}`);
      console.log(`Actual caller: ${deployer.address}`);
      return;
    }
    
    // Set the new app address
    console.log("Setting new app address...");
    const tx = await poolProxy.setAppAddress(newAppAddress);
    console.log("Transaction sent:", tx.hash);
    
    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Verify the new app address
    const updatedAppAddress = await poolProxy.getAppAddress.staticCall();
    console.log("Updated app address:", updatedAppAddress);
    
    if (updatedAppAddress.toLowerCase() === newAppAddress.toLowerCase()) {
      console.log("✅ App address successfully updated");
    } else {
      console.log("❌ App address update failed");
      console.log(`Expected: ${newAppAddress}`);
      console.log(`Got: ${updatedAppAddress}`);
    }
  } catch (error: any) {
    console.error("Error during app address update:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 