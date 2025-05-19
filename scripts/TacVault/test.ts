import hre, { ethers } from "hardhat";
import { ERC20, ITellerWithMultiAssetSupport } from "../../typechain-types";
import { tacVaultTestnetConfig } from "./config/TacVaultTestnetConfig";
async function main() {
    const provider = hre.ethers.provider;
    // const [signer] = await hre.ethers.getSigners();

    console.log(await provider.getBlockNumber());
    const wallet = new ethers.Wallet(process.env.TESTNET_ACCOUNT_PK || "", provider);
    console.log(wallet.address);
    const asset = new ethers.Contract("0xe3a2296bE422768a630eb35014978A808D106899", hre.artifacts.readArtifactSync('ERC20').abi, wallet) as unknown as ERC20;
    const teller = new ethers.Contract(tacVaultTestnetConfig.teller, hre.artifacts.readArtifactSync('ITellerWithMultiAssetSupport').abi, wallet) as unknown as ITellerWithMultiAssetSupport;
    await asset.connect(wallet).transfer("0xEc2AbA7460bA1E469673e901ac0d5ad407791264", ethers.parseUnits("0.1", 9n))
    // let tx = await teller.deposit(await asset.getAddress(), ethers.parseUnits("0.01", await asset.decimals()), 0n);
    // await tx.wait();
    
}

main().catch(console.error);