const { deployToken } = require('../utils.js');


async function main(suffix) {
    const tokenAAddress = await deployToken(
        `stTON${suffix}`, `stTON${suffix}`, 9, 
        'EQBFqkxrlEW5hZ_oEW0sBFWJjQVYsfy8CQBkVS53DsVtvB8U')
    const tokenBAddress = await deployToken(
        `TAC'${suffix}`, `TAC${suffix}`, 9, 
        'EQCJZiRkO77bNT8vDOsqCev5Rx4urCRJ6pcZpQb8go0I_T06')

    console.log(tokenAAddress, tokenBAddress);    
}


main('');
