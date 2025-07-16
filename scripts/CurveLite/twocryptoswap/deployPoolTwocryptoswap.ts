import hre, { ethers } from 'hardhat';
import factoryAbi from "./factoryAbi.json"
import {CurveLiteTwocryptoswapTestnetConfig} from "./config/testnetConfig"




export async function deployPoolTwocryptoswap(tokenAddress1: string, tokenAddress2: string, name: string, symbol: string, poolParams: any): Promise<string> {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const factoryContract = new ethers.Contract(CurveLiteTwocryptoswapTestnetConfig.CurveLiteTwocryptoswapFactory, factoryAbi, deployer);
    const gasPrice = ethers.parseUnits("50", "gwei");

    const tx = await factoryContract.deploy_pool(name, symbol, [tokenAddress1, tokenAddress2], ...Object.values(poolParams),
        {
            gasLimit: 5000000,
            gasPrice: gasPrice
        });

    const receipt = await tx.wait();
    const poolCount = await factoryContract.get_market_counts(tokenAddress1, tokenAddress2);
    const poolAddress = await factoryContract.find_pool_for_coins(tokenAddress1, tokenAddress2, poolCount-1n);

    return poolAddress
}



