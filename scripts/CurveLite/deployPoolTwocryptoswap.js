const { ethers } = require('hardhat')


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

async function main(tokenA, tokenB, name, symbol) {
    const signer = (await ethers.getSigners())[0];
    const factoryContract = new ethers.Contract(process.env.CURVE_LITE_TWOCRYPTOSWAP_FACTORY_ADDRESS, ABI, signer);
    const gasPrice = ethers.parseUnits("50", "gwei");

    const tx = await factoryContract.deploy_pool(name, symbol, [tokenA, tokenB], ...Object.values(poolPresetParams),
        {
            gasLimit: 5000000,
            gasPrice: gasPrice
        });

    const receipt = await tx.wait();

    console.log(receipt)
}


main(
    // process.env.EVM_TKA_ADDRESS,
    // process.env.EVM_TKB_ADDRESS,
    '0x2CB284c531fB21A70E2c24EDe980239e643b7B5d',
    '0x928d8Aa02a9Fd54ad3E203f7d79A03d1077c51F5',
    'stTON-TAC',
    'STTONTAC',
);
