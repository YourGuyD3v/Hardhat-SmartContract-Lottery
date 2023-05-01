const { run } = require("hardhat")

const verify = async (contractAddress, args) => {
    console.log("Verifying, Please wait...")
    try {
    await run("verify:verify", {
        address: contractAddress,
        constructorArguments: args
    }) } catch (e) {
        if (e.message.toLowerCase().includes("Already verified!")) {
            console.log("Already verified!")
        } else {
            console.log(e)
        }
    }
}

module.exports = { verify }