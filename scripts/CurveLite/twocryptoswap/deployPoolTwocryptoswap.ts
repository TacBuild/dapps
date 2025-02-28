import hre, { ethers } from 'hardhat';
import factoryAbi from "./factoryAbi.json"


const poolPresetParams = {
    implementation_id: 0,
    A: 20000000n,
    gamma: 1000000000000000n,
    mid_fee: 5000000n,
    out_fee: 45000000n,
    fee_gamma: 5000000000000000n,
    allowed_extra_profit: 10000000000n,
    adjustment_step: 5500000000000n,
    ma_exp_time: 866n,
    initial_price: 10n ** 18n
}


export async function deployPoolTwocryptoswap(tokenAddress1: string, tokenAddress2: string, name: string, symbol: string): Promise<string> {
    const signer = (await ethers.getSigners())[0];
    
    const factoryContract = new ethers.Contract(process.env.CURVE_LITE_TWOCRYPTOSWAP_FACTORY_ADDRESS as string, factoryAbi, signer);
    const gasPrice = ethers.parseUnits("50", "gwei");

    const tx = await factoryContract.deploy_pool(name, symbol, [tokenAddress1, tokenAddress2], ...Object.values(poolPresetParams),
        {
            gasLimit: 5000000,
            gasPrice: gasPrice
        });

    const receipt = await tx.wait();

    const poolAddress = await factoryContract.find_pool_for_coins(tokenAddress1, tokenAddress2, 0);

    return poolAddress
}



