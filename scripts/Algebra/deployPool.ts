import hre, { ethers } from 'hardhat';
import factoryABI from "./abis/factoryABI.json"
import {algebraTestnetConfig} from "./config/testnetConfig"



export async function deployPool(tokenAddress1: string, tokenAddress2: string, name: string, symbol: string): Promise<string> {
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const factoryContract = new ethers.Contract(algebraTestnetConfig.algebraFactory, factoryABI, sequencerSigner);
    const gasPrice = ethers.parseUnits("50", "gwei");

    const tx = await factoryContract.createPool(tokenAddress1, tokenAddress2, "0x",
        {
            gasLimit: 5000000,
            gasPrice: gasPrice
        });

    const receipt = await tx.wait();
    console.log(receipt)
    const poolAddress = await factoryContract.computePoolAddress(tokenAddress1, tokenAddress2);

    return poolAddress
}




