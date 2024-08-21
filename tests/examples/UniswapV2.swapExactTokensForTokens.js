const { ethers } = require('hardhat');

const {
    printEvents,
    getContract,
    hexStringToByteArray,
}  = require('../../scripts/utils.js');
const {
    baseSetUp,
    printBalances
} = require('./UniswapV2.utils.js');


async function setUp() {
    // first add liquidity from outside!
}


it("UniswapV2: swapExactTokensForTokens", async()=>{
    await baseSetUp();
    await setUp();

    await printBalances('Balances before action');

    const utilsContract = await getContract('MerkleTreeUtils', 'MerkleTreeUtils');
    const crossChainLayerContract = await getContract('CrossChainLayer', 'CrossChainLayer');
    const groupContract = await getContract('Group', 'Group1');
    const appProxyContract = await getContract('UniswapV2Proxy', 'UniswapV2Proxy');
    const tokenTKAContract = await getContract('CrossChainLayerToken', 'TKA');
    const tokenTKBContract = await getContract('CrossChainLayerToken', 'TKB');

    // message#2: SWAP_EXACT_TOKENS_FOR_TOKENS
    const amountIn = 10n * 10n**9n;
    const amountOutMin = 5n * 10n**9n;
    const path = [await tokenTKAContract.getAddress(), await tokenTKBContract.getAddress()];
    const to = await appProxyContract.getAddress();
    const deadline = 19010987500n;
    const args = new ethers.AbiCoder().encode(
        ['uint256', 'uint256', 'address[]', 'address', 'uint256'],
        [amountIn, amountOutMin, path, to, deadline]
    );

    const messageSwapExactTokensForTokens = {
        queryId: 123,
        timestamp: Math.floor(Math.random() * 2**32),
        target: await appProxyContract.getAddress(),
        methodName: 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
        arguments: args,
        caller: 'EQCEuIGH8I2bkAf8rLpuxkWmDJ_xZedEHDvjs6aCAN2FrkFp',
        mint: [
            {tokenAddress: await tokenTKAContract.getAddress(), amount: amountIn},
        ],
        unlock: [],
    };

    console.log('>>> message to send:', messageSwapExactTokensForTokens)
    console.log('>>> args:', (JSON.stringify(hexStringToByteArray(args, null, 2))))

    // act
    const messageHash = await utilsContract.hashInMessage(messageSwapExactTokensForTokens)
    console.log(messageSwapExactTokensForTokens);
    console.log('msg hash hex:  ', messageHash);
    console.log('msg hash bytes:', hexStringToByteArray(messageHash));

    // set proper Merkle root for a single message (one leaf tree)
    console.log('setting Merkle root to ', messageHash)
    console.log('epoch before setting Merkle root:', await groupContract.getCurrentEpoch())

    await groupContract.vote(messageHash)

    // execute message
    console.log('CrossChainLayer execute message')
    const tx = await crossChainLayerContract.receiveMessage(messageSwapExactTokensForTokens, [], 0);
    await printBalances('After call message', tx);

    console.log('\n------------------- Events -------------------\n')
    printEvents(await tx.wait(), crossChainLayerContract);
})
