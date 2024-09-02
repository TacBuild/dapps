
const { sendSimpleMessage } = require('../utils.js');





async function main() {

    const amount = 1000000000000
    const recipientAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

    const tokenFactoryAddress = process.env.EVM_CCLTOKENMANAGER_ADDRESS;
    const TKAAddress = process.env.EVM_TKA_ADDRESS
    const TKBAddress = process.env.EVM_TKB_ADDRESS

    const tokenAddress = TKBAddress

    // create and send CCL message

    const message = {
        target: tokenFactoryAddress,
        methodName: 'deposit(address,uint256,address)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'uint256', 'address'],
            [tokenAddress, amount, recipientAddress]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {tokenAddress: tokenAddress, amount: amount}
        ],
        unlock: [],
    };

    return await sendSimpleMessage(message);

}



main();

