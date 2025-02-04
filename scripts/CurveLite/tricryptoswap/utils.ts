import hre, { ethers } from 'hardhat';
import implementationAbi from "./implementationAbi.json"
import factoryAbi from "./factoryAbi.json"


export async function getCoinsFromPool(poolAddress: string):Promise<[string, string, string]>  {
    const signer = (await ethers.getSigners())[0];
    const poolContract = new ethers.Contract(poolAddress, implementationAbi, signer);
    const coin1 = await poolContract.coins(0);
    const coin2 = await poolContract.coins(1);
    const coin3 = await poolContract.coins(2);
    return [coin1, coin2, coin3]
}

export async function getPoolFromCoins(factoryAddress: string,tokenAddress1: string, tokenAddress2: string) {
    const signer = (await ethers.getSigners())[0];
    const factoryContract = new ethers.Contract(factoryAddress, factoryAbi, signer);
    const poolAddress = await factoryContract.find_pool_for_coins(tokenAddress1, tokenAddress2, 0);
    return poolAddress
}

