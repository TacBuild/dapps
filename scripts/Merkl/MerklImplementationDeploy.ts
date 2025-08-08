import hre from "hardhat";
import { merklDeployments } from "./config/MainnetConfig";

export async function deployMerklImplementation() {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("MerklProxy", signer);
    const implementatioAddress = await hre.upgrades.prepareUpgrade(merklDeployments.merklProxy, factory, {
        kind: "uups",
        unsafeAllow: ["constructor"]
    });
    console.log("Implementation address:", implementatioAddress)    
}

deployMerklImplementation();