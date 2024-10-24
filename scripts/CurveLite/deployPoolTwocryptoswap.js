const { ethers } = require('hardhat')

const {
    getTokenAddress,
} = require('../utils.js');
const {
    getPoolFinderContract, 
} = require('./utils.js');


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

const ABI = [{
    "stateMutability": "nonpayable",
    "type": "function",
    "name": "deploy_pool",
    "inputs": [
        {
            "name": "_name",
            "type": "string"
        },
        {
            "name": "_symbol",
            "type": "string"
        },
        {
            "name": "_coins",
            "type": "address[2]"
        },
        {
            "name": "implementation_id",
            "type": "uint256"
        },
        {
            "name": "A",
            "type": "uint256"
        },
        {
            "name": "gamma",
            "type": "uint256"
        },
        {
            "name": "mid_fee",
            "type": "uint256"
        },
        {
            "name": "out_fee",
            "type": "uint256"
        },
        {
            "name": "fee_gamma",
            "type": "uint256"
        },
        {
            "name": "allowed_extra_profit",
            "type": "uint256"
        },
        {
            "name": "adjustment_step",
            "type": "uint256"
        },
        {
            "name": "ma_exp_time",
            "type": "uint256"
        },
        {
            "name": "initial_price",
            "type": "uint256"
        }
    ],
    "outputs": [
        {
            "name": "",
            "type": "address"
        }
    ]
}]

async function main(name, symbol) {
    // resolve token EVN addresses
    const tokenA = await getTokenAddress(process.env.TVM_TKA_ADDRESS);
    const tokenB = await getTokenAddress(process.env.TVM_TKB_ADDRESS);
    console.log('deploying pool for pair:', tokenA, tokenB);

    const signer = (await ethers.getSigners())[0];
    const factoryContract = new ethers.Contract(process.env.CURVE_LITE_TWOCRYPTOSWAP_FACTORY_ADDRESS, ABI, signer);
    const gasPrice = ethers.parseUnits("50", "gwei");

    const tx = await factoryContract.deploy_pool(name, symbol, [tokenA, tokenB], ...Object.values(poolPresetParams),
        {
            gasLimit: 5000000,
            gasPrice: gasPrice
        });

    const receipt = await tx.wait();


    const poolFinder = await getPoolFinderContract(process.env.CURVE_LITE_TWOCRYPTOSWAP_FACTORY_ADDRESS);
    const poolAddress = await poolFinder.find_pool_for_coins(tokenA, tokenB, 0);

    console.log('OK =', receipt.status == 1)
    console.log('Pool address:', poolAddress)
}


main(
    'stTON-TAC-v2',
    'STTONTAC2',
);
