const { deployToken } = require('../utils.js');


async function main() {
    const tkaAddress = await deployToken('Token TKA', 'TKA', 9, 'EQATbyZLi_Lcze4W-iX-fxWfPJmRf4bPovwu4DZHOGNMjYer', 'EQDZ59MRm8y46JHTObphEg2Nc6dnc_3IHb8tVCIsE8URSd8h')
    const tkbAddress = await deployToken('Token TKB', 'TKB', 9, 'EQCh0U6KMr43yco9Ih3oDGqJbWWhPejQ8NEM_vaWv9DwMYul', 'EQB7I1azzD4hPFP3pHEviNS4aYT7TjbIx0LRc09A1bnDhUB0')
    const tkcAddress = await deployToken('Token TKC', 'TKC', 9, 'UQAkt8jdhSqv6UjhVZr6xO3DKARyaP3UcEl7X2q-RVzaxs6l', 'EQBSewllwBq0oOkEoSwv0OgG1qvMK63bQQ9kf2_T5OGhko6C')
}


main();
